var ExpectedResponse = function (value, renderedValue) {
    this._value = value;
    this._renderedValue = renderedValue;
    this.checkInput = function(input) {
        return true;
    };
    this.toString = function() { return '[ExpectedResponse: ' + this._renderedValue + ']'; };
};

ExpectedResponse.any = new ExpectedResponse();

ExpectedResponse.text = function(value) {
    if (!value)
        throw 'No value was specified for a text ExpextedResponse';

    var er = new ExpectedResponse(value, value);
    er.checkInput = function(input) {
        if (!input)
            return false;
        var check = er._value.toLowerCase();
        if (input instanceof Array) {
            for (var i = 0; i < input.length; i++)
                if (input[i].toLowerCase() == check)
                    return true;
            return false;
        }
        else if (typeof input == 'string')
            return input.toLowerCase() == er._value.toLowerCase();
        else
            throw 'Unexpected input type';
    };
    return er;
};

ExpectedResponse.ok = ExpectedResponse.text('OK');

ExpectedResponse.byteCount = function(numberOfBytes) {
    var countBytesInString = function(input) {
        var nHex = input.replace ? input.replace(' ', '') : input,
            nInt = parseInt(nHex, 16);
        if (isNaN(nInt))
            return 0;
        return nHex.length / 2;
    };

    var er = new ExpectedResponse(numberOfBytes, numberOfBytes + ' bytes');
    er.checkInput = function(input) {
        if (!input)
            return false;
        var count = 0;
        if (input instanceof Array)
            for (var i = 0; i < input.length; i++)
                count += countBytesInString(input[i]);
        else if (typeof input == 'string')
            count = countBytesInString(input);
        else
            throw 'Unexpected input type';
        return count == this._value;
    };
    return er;
};

exports['ExpectedResponse'] = ExpectedResponse;