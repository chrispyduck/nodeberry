'use strict';
/*eslint nomen: true */
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var SerialPort = require('serialport').SerialPort;
var BitArray = require('node-bitarray');
var KnownCommands = require('./KnownCommands').KnownCommands;
var _obdCommand = require('./ObdCommand'),
    ObdCommand = _obdCommand.ObdCommand,
    CustomObdCommand = _obdCommand.CustomObdCommand;
var ExpectedResponse = require('./ExpectedResponse.js').ExpectedResponse;

var Obd = function (port, options) {
    this._connected = false;
    EventEmitter.call(this);
    this._port = port;
    this._options = options;
    this._rawReceivedData = '';
    this._readQueue = [];
    this._writeQueue = [];
    this._readTimer = null;
    this._readWaitTime = 100;
    return this;
};

util.inherits(Obd, EventEmitter);

Obd.prototype._log = function (message) {
    console.log('[' + this._port + '] ' + message);
};

Obd.prototype.disconnect = function() {
    this.serialport.close();
    this.serialport = null;

    if (this._readTimer)
        clearTimeout(this._readTimer);
};

Obd.prototype.connect = function () {
    var self = this;
    self._log('opening port');
    this.serialport = new SerialPort(this._port, this._options, false);
    
    this.serialport.on('close', function (err) {
        if (!err)
            self._log('port closed');
        else
            self._log('port closed: ' + err);
    });
    
    this.serialport.on('error', function (err) {
        self._log("port not ready: " + err);
    });
    
    this.serialport.on('open', function () {
        self._log('port opened. negotiating connection.');
        self.connected = true;
        self._initCommands = [
            'ATZ', // reset
            'ATE0', //Turns off echo.
            'ATL0', //Turns off extra line feed and carriage return
            'ATS0', //This disables spaces in in output, which is faster!
            'ATH0', //Turns off headers and checksum to be sent.
            'ATAT2', //Turn adaptive timing to 2. This is an aggressive learn curve for adjusting the timeout. Will make huge difference on slow systems.
            'ATSPA8' //Set the protocol to whatever #8 is.
        ];
        
        self._write('ATZ');
        //self.write('ATST0A'); //Set timeout to 10 * 4 = 40msec, allows +20 queries per second. This is the maximum wait-time. ATAT will decide if it should wait shorter or not.
    });
    
    this.serialport.on('data', function (data) {
        self._rawReceivedData += data.toString('utf8');
        self._parseSerialCommands();
    });
    
    this.serialport.open();
};

Obd.prototype.enqueueCommand = function (command, callback) {
    if (!(command instanceof ObdCommand)) {
        // wrap given string command in an ObdCommand instance
        var temp = new CustomObdCommand('Ad-Hoc Command: ' + command,
            command,
            ExpectedResponse.any);
        command = temp;
    }
        
    this._writeQueue.push({
        command: command,
        callback: callback,
        sent: false
    });
    this._log('(+)Q: ' + command);
    this._processWriteQueue();
};

Obd.prototype._processWriteQueue = function () {
    if (this._writeQueue.length == 0)
        return;
    
    var item = this._writeQueue[0];
    if (item.sent) {
        // we're waiting on a command to come back; do nothing
        return;
    }
    
    // mark this command as sent and move on
    item.sent = true;
    this._write(item.command.getCommandString());
};

// low level write and drain method 
Obd.prototype._write = function (rawCommand, callback) {
    this._log('--> ' + rawCommand);
    rawCommand += '\r\n';
    try {
        var port = this.serialport;
        if (!port)
            throw "Port closed. Cannot write.";
        port.write(rawCommand, function() {
            port.drain(callback);
        });
    } catch (err) {
        this._log('Error while writing: ' + err + '\n' + err.stack);
    }
};

Obd.prototype._negotiateConnection = function () {
    if (this._initCommands.length == 0) {
        this._querySupportedPids();
        return;
    }
    
    var nextCommand = this._initCommands[0];
    this._write(nextCommand);
};

Obd.prototype._parseSerialCommands = function () {
    // process each line individually
    var parts = this._rawReceivedData.split(/[\r\n]/);
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        
        if (part == '>' || !part)
            // skip carets and empty responses
            continue;
        
        if (i == parts.length - 1 && part.slice(-1)[0] != '>') {
            // incomplete command; save for later
            this._log('Saving partial response: "' + part + '"');
            this._rawReceivedData = part;
            return;
        }
        
        if (part == "SEARCHING...") {
            this._log('Received "SEARCHING" response. Waiting a while.');
            this._restartReadTimer(5000);
            continue;
        }
        
        this._log('<-- ' + part);
        
        // special handling for link negotiation
        if (this._initCommands.length > 0) {
            if (part == this._initCommands[0])
                continue;
            if (part == 'OK' || part.slice(0, 3) == 'ELM') {
                // pop the first item off the init commands list, and move to the next
                this._initCommands.shift();
                this._negotiateConnection();
                continue;
            }
        }
        
        // todo: see if we've received all the bytes we're expecting
        this._readQueue.push(part);
        this._continueRead();
    }
    this._rawReceivedData = '';
};

Obd.prototype._continueRead = function () {
    if (this._writeQueue && this._writeQueue.length > 0) {
        // get the command object and see if we've received our expected response
        var command = this._writeQueue[0];
        if (command.expectedResponse.checkInput(this._readQueue)) {
            this._finishRead();
            return;
        }
    }
    
    // we don't know what we're waiting for or we're still waiting for data
    this._restartReadTimer();
};

// every time we get data, we need to restart our timer to see if something else is coming down the pipe
Obd.prototype._restartReadTimer = function (delay) {
    delay = delay || this._readWaitTime;
    var self = this;
    if (this._readTimer) {
        clearTimeout(this._readTimer);
        this._log('debug: clear read timer');
    }
    this._readTimer = setTimeout(function () { self._finishRead(); }, delay);
    this._log('debug: start read timer');
};

// declare the data final and return it to the function that requested it
Obd.prototype._finishRead = function () {
    if (this._readTimer)
        clearTimeout(this._readTimer);

    if (!this._writeQueue || this._writeQueue.length == 0) {
        this._log('warning: _finishRead() called but _writeQueue was empty');
        return;
    }

    // pop the item off the queue and invoke its callback method
    var item = this._writeQueue.shift();
    this._log('(-)Q: ' + item.command);
    try {
        if (this._readQueue.length == 1 && this._readQueue[0] == 'UNABLE TO CONNECT') {
            this._log('ELM reports unable to connect to OBD. Command "' + item.command + '" failed.');
            item.callback(item.command, false);
        } else 
            item.callback(item.command, this._readQueue);
    } catch(err) {
        this._log('Unexpected error in queued write callback: ' + err + '\n' + err.stack);
    }
    this._readQueue = [];
    
    // process the next item on the write queue
    this._processWriteQueue();
};

Obd.prototype._querySupportedPids = function () {
    var self = this;
    
    var complete = function() {
        self._log('negotiation complete. connection established.');
        self.emit('connected');
    };

    var handleResponse = function (cmdSent, data) {
        if (!data)
            return;
        if (data == 'NO DATA') {
            complete();
            return;
        }
        var more = false;
        self._log('Supported commands:');
        var bitArray = BitArray.fromHexadecimal(data);
        var array = bitArray.__bits;
        for (var i = 0; i < array.length; i++) {
            var enabled = array[i] == 1;
            var pid = i + 1 + parseInt(cmdSent.slice(2));
            var cmd = KnownCommands.find(1, pid);
            if (!cmd)
                continue;
            cmd.supported = enabled;

            KnownCommands.find(2, pid).supported = enabled;

            if (enabled) {
                self._log('\t* ' + cmd.desc);
                if (i == array.length - 1) {
                    self.enqueueCommand(cmd, handleResponse);
                    more = true;
                }
            }
        }
        
        if (!more)
            complete();
    };

    this.enqueueCommand(KnownCommands.find(0x01, 0x00), handleResponse);
};

Obd.prototype.getSupportedCommands = function () {
    var k = [];
    for (var i = 0; i < KnownCommands.length; i++)
        if (KnownCommands[i].supported && KnownCommands[i].mode != 2)
            k.push(KnownCommands[i]);
    return k;
};

exports['Obd'] = Obd;