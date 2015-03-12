var fs = require('fs');
var parseCsvRow = require('csvrow').parse;
var _obdCommand = require('./ObdCommand'),
    ObdCommand = _obdCommand.ObdCommand,
    StandardObdCommand = _obdCommand.StandardObdCommand,
    CustomObdCommand = _obdCommand.CustomObdCommand;
var util = require('util');

var knownCommands = new Array();
knownCommands.loadFromFile = function(filename) {
    console.log('[ObdCommand] parsing file ' + filename);
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split('\n');
    for (var idx in lines) {
        if (idx == 0)
            // skip header row
            continue;
            
        var row = parseCsvRow(lines[idx]);
        if (!row)
            continue;
        //"Mode (hex)", "PID (hex)", "Data bytes returned", Description, "Min value", "Max value", Units, Formula
        this.push(new StandardObdCommand(row[3], row[0], row[1], row[2]));
    }
};

knownCommands.find = function(mode, pid) {
    for (var i = 0; i < this.length; i++)
        if (this[i].mode == mode && this[i].pid == pid)
            return this[i];
    return null;
};

knownCommands.push = function(command) {
    Array.prototype.push.call(this, command);
    if (command.mode == 1) {
        var clone = util._extend({}, command);
        clone.mode = 2;
        Array.prototype.push.call(this, clone);
    }
};

knownCommands.loadFromFile('./pids/standard.csv');

exports['KnownCommands'] = knownCommands;