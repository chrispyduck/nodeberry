var assert = require('assert');
var ExpectedResponse = require('../ExpectedResponse.js').ExpectedResponse;

exports['tests'] = {
    "Byte Count": function (test) {
        test.expect(7);
        var er = ExpectedResponse.byteCount(3);
        test.ok(er instanceof ExpectedResponse, 'type verification');
        test.ok(er.checkInput('01A0BE'), 'positive case');
        test.ok(!er.checkInput('01'), 'negative case #1');
        test.ok(!er.checkInput('01A0'), 'negative case #2');
        test.ok(!er.checkInput('01A0BE34'), 'negative case #3');
        test.ok(er.checkInput(['01', '02', '03']), 'byte string array');
        test.ok(!er.checkInput('xyzpdq'), 'non-numeric negative case');
        test.done();
    },
    "String": function (test) {
        test.expect(4);
        var er = ExpectedResponse.text('ok');
        test.ok(er instanceof ExpectedResponse, 'type verification');
        test.ok(er.checkInput('ok'), 'case sensitive');
        test.ok(er.checkInput('OK'), 'case insensitive');
        test.ok(!er.checkInput('sdlkfj'), 'something else');
        
        test.done();
    },
    "Any": function (test) {
        test.expect(5);
        var er = ExpectedResponse.any;
        test.ok(er instanceof ExpectedResponse, 'type verification');
        test.ok(er.checkInput(null), 'null');
        test.ok(er.checkInput(true), 'true');
        test.ok(er.checkInput(false), 'false');
        test.ok(er.checkInput('my string'), 'string');
        test.done();
    }
};