'use strict';
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var SerialPort = require('serialport').SerialPort;

var Obd = function(port, options) {
    this._connected = false;
    EventEmitter.call(this);
    this._port = port;
    this._options = options;
    this._receivedData = '';
    return this;
};

util.inherits(Obd, EventEmitter);

Obd.prototype.log = function(message) {
    console.log('[' + this._port + '] ' + message);
};

Obd.prototype.connect = function() {
    var self = this;
    self.log('opening port');
    this.serialport = new SerialPort(this._port, this._options, false);
    
    this.serialport.on('close', function (err) {
        self.log("port closed: " + err);
    });
    
    this.serialport.on('error', function (err) {
        self.log("port not ready: " + err);
    });
    
    this.serialport.on('open', function () {
        self.log('port opened. negotiating connection.');
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
        self._receivedData += data.toString('utf8');
        self._parseSerialCommands();
    });
    
    this.serialport.open();
};

Obd.prototype._write = function (command) {
    this.log('--> ' + command);
    command += '\r\n';
    try {
        this.serialport.write(command);
    } catch(err) {
        this.log('Error while writing: ' + err);
    }
};

Obd.prototype._negotiateConnection = function () {
   if (this._initCommands.length == 0) {
        this.log('negotiation complete. connection established.');
        this.emit('connected');
        return;
    }

    var nextCommand = this._initCommands[0];
    this._write(nextCommand);
};

Obd.prototype._parseSerialCommands = function() {
    var parts = this._receivedData.split(/[\r\n]/);
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        
        if (part == '>' || !part)
            // skip carets and empty responses
            continue;
        
        if (i == parts.length - 1 && !part.slice(-1)[0] == '>') {
            // incomplete command; save for later
            this._receivedData = part;
            return;
        }
        
        this.log('<-- ' + part);
        
        // special handling for link negotiation
        if (this._initCommands.length > 0) {
            if (part == this._initCommands[0])
                continue;
            if (part == 'OK' || part.slice(0,3) == 'ELM') {
                // pop the first item off the init commands list, and move to the next
                this._initCommands.shift();
                this._negotiateConnection();
            }
        }
        
        //todo: parse and dispatch part
    }
    this._receivedData = '';
};

exports['Obd'] = Obd;