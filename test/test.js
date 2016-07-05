var async = require('async');
var IniConfigParser = require('../');
var util = require('util');

exports.testDefault = function testDefault(test) {
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

    test.deepEqual(config, expect);
    test.done();
};

exports.testCoerce = function testCoerce(test) {
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
    test.deepEqual(config, expect);
    test.done();
};

require('coffee-script').register();
exports.testExtended = function testExtended(test) {
    var fs = require('fs'),
        FSM = require('../src/Parser'),
        comments = [
            ['line-comment', 'comment'],
            ['line-comment', 'comment'],
            ['line-comment', 'comment'],
            ['line-comment', 'comment'],
            ['block-comment', 'block comment\nblock comment\nblock comment'],
            ['block-comment', 'block\ncomment'],
            ['line-comment', 'inline comment'],
            ['line-comment', 'inline comment'],
            ['block-comment', 'inline comment'],
        ],
        expect = {
            global: {
                'key0': 'val0',
                'key1': 'val1',
                'key2': 'val2',
                'key3': 'val 3',
                'key4': 'val 4',
                'key 5': 'val5',
                'key 6': 'val 6',
                'key7': 'val7',
                'key8': 'val8',
                'key9': 'val9',
                'key10': 'val10',
                'key11': 'val11',
                'key12': 'val12',
                'key13': 'val13',
                '\nkey14\n': 'val14',
            },
            sections: {}
        },
        config;
    fsm = new FSM({
        onComment: function(comment, state) {
            var args = comments.shift();
            test.deepEqual(args, [state, comment.trim()]);
        }
    });

    config = fsm.parse(fs.readFileSync(__dirname + '/comment.ini', 'utf-8'));
    test.strictEqual(comments.length, 0);
    test.deepEqual(config, expect);

    // test.throws(function() {
    //     fsm.parse(':toto');
    // });
    // test.throws(function() {
    //     fsm.parse('=toto');
    // });
    // test.throws(function() {
    //     fsm.parse(' :toto');
    // });
    // test.throws(function() {
    //     fsm.parse(' =toto');
    // });
    // test.throws(function() {
    //     fsm.parse('"tata"y= toto');
    // });

    test.done();
};