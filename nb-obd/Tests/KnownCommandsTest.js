var assert = require('assert');

exports['tests'] = {
    "LoadAndScan": function (test) {
        test.expect(3);
        var kc = require('../KnownCommands.js').KnownCommands;
        test.ok(kc.length > 0, '>0 known commands');
        test.ok(kc.find(1, 0) != null, '0100 exists');
        test.ok(kc.find(1, 0).getCommandString() == '0100', 'expected command string');
        test.done();
    }
};