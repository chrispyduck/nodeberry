var ExpectedResponse = require('./ExpectedResponse.js').ExpectedResponse;

// Abstract ObdCommand type
var ObdCommand = function (name, expectedResponse) {
    this.name = name;
    if (!(expectedResponse instanceof ExpectedResponse))
        throw 'Parameter expectedResponse was not an instance of ExpectedResponse';
    this.expectedResponse = expectedResponse;
};

ObdCommand.prototype.getCommandString = function () {
    throw 'Not implemented';
};

ObdCommand.prototype.toString = function() {
    return this.prepareToSend();
};

exports['ObdCommand'] = ObdCommand;

// --------------------------------------------------------------------
//       Standard 2-byte OBD command using mode and pid
// --------------------------------------------------------------------
var StandardObdCommand = function (name, mode, pid, expectedBytes) {
    ObdCommand.call(this, 
        name, 
        (expectedBytes > 0)
            ? ExpectedResponse.byteCount(expectedBytes)
            : ExpectedResponse.any);
    this.mode = mode;
    this.pid = pid;
    this.bytes = expectedBytes; // number of bytes expected in return
    this.supported = false;
};
StandardObdCommand.prototype = Object.create(ObdCommand.prototype);

StandardObdCommand.prototype.getCommandString = function () {
    var a = this.mode.toString(16);
    if (a.length == 1)
        a = "0" + a;
    var b = this.pid.toString(16);
    if (b.length == 1)
        b = "0" + b;
    return a + b;
};

// --------------------------------------------------------------------
//       A non-standard command with custom validation
// --------------------------------------------------------------------
var CustomObdCommand = function(name, command, expectedResponse) {
    ObdCommand.call(this,
        name,
        expectedResponse);
    this.command = command;
};
CustomObdCommand.prototype = Object.create(ObdCommand.prototype);

CustomObdCommand.prototype.getCommandString = function () {
    return this.command;
};

exports['StandardObdCommand'] = StandardObdCommand;