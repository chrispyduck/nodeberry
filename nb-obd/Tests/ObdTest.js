var assert = require('assert');
var Obd = require('../Obd').Obd;

exports['tests'] = {
    "ObdTest": function (test) {
        test.expect(2);

        //var obd = new Obd('COM4', { baudrate: 38400 });
        var obd = new Obd('COM4', { baudrate: 38400 });
        obd.connect();

        obd.on('connected', function () {
            console.log('It works!');
            obd.disconnect();
            test.ok(true, 'connected');
            test.ok(obd.getSupportedCommands().length > 5, 'supported command count');
        });

        setTimeout(test.done, 10000);
    }
};
