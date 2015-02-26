var assert = require('assert');
var Obd = require('../Obd').Obd;
var EventEmitter = require('events').EventEmitter;
var SerialPort = require('serialport');
//var test = require('test-suite');

exports['tests'] = {
    /*"ListSerialPorts": function(test) {
        var serialPort = require("serialport");
        serialPort.list(function(err, ports) {
            ports.forEach(function(port) {
                console.log(port.comName + '\t' + port.pnpId + '\t' + port.manufacturer);
            });
        });
        test.done();
    },*/
    "ObdTest": function(test) {
        var obd = new Obd('COM4', { baudrate: 115200 });
        obd.connect();
        test.done();
    }
};