var async = require('async');
var IniConfigParser = require('../');
var util = require('util');

module.exports = {
    testDefault: testDefault,
    testCoerce: testCoerce
};

function testDefault(assert) {
    var config = IniConfigParser.parse(__dirname + '/config.ini'),
        expect = {
            production: {
                server: {
                    port: '$PORT',
                    host: '$HOST'
                },
                redis: {
                    host: 'x.x.x.x',
                    port: '7468',
                    db: '1',
                    ttl: '3600'
                }
            },
            development: {
                server: {
                    port: '$PORT',
                    host: '$HOST'
                },
                redis: {
                    host: 'localhost',
                    port: '6379',
                    db: '1',
                    ttl: '3600'
                },
                smtp: {
                    server: '127.0.0.1',
                    port: '587'
                },
                client: {
                    routes: {
                        defaults: {
                            language: 'fr'
                        }
                    }
                }
            }
        };

    assert.deepEqual(config, expect);
    assert.done();
}

function testCoerce(assert) {
    process.env.HOST = '127.0.0.1';
    process.env.PORT = '3000';
    var parse = IniConfigParser(),
        config = parse(__dirname + '/config.ini'),
        expect = {
            development: {
                server: {
                    port: '3000',
                    host: '127.0.0.1'
                },
                redis: {
                    host: 'localhost',
                    port: 6379,
                    db: 1,
                    ttl: 3600
                },
                smtp: {
                    server: '127.0.0.1',
                    port: 587
                },
                client: {
                    routes: {
                        defaults: {
                            language: 'fr'
                        }
                    }
                }
            },
            production: {
                server: {
                    port: '3000',
                    host: '127.0.0.1'
                },
                redis: {
                    host: 'x.x.x.x',
                    port: 7468,
                    db: 1,
                    ttl: 3600
                }
            }
        };
    assert.deepEqual(config, expect);
    assert.done();
}

if (!/\bnodeunit$/.test(process.argv[1])) {
    var reporter = require('nodeunit').reporters.default;
    reporter.run({
        test: module.exports
    });
} else if (false) {
    // For debugging purpose
    var assert = require('assert');
    var testSuite = module.exports;
    tests = [];
    for (prop in testSuite) {
        (function(fn) {
            tests.push(function(next) {
                assert.done = next;
                fn(assert);
            });
        })(testSuite[prop]);
    }
    async.series(tests, function() {
        console.log('done');
    });
}