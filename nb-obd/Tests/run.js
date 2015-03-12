var reporter = require('nodeunit').reporters.default;
reporter.run(['Tests/ExpectedResponseTest.js']);
reporter.run(['Tests/KnownCommandsTest.js']);
reporter.run(['Tests/ObdTest.js']);
