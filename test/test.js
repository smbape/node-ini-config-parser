/* jshint mocha: true */
/* globals assert: false */

var IniConfigParser = require('../'),
    util = require('util'),
    fs = require('fs'),
    Parser = require('../src/Parser');

exports.testNoDot = function testNoDot() {
    var parser = new Parser({
            env: {},
            nativeType: false,
            dotKey: false
        }),
        data = fs.readFileSync(__dirname + '/config.ini').toString(),
        config = parser.parse(data),
        expect = {
            production: {
                'key': 'value',
                'server.port': '$PORT',
                'server.host': '$HOST',
                'redis.host': 'x.x.x.x',
                'redis.port': '7468',
                'redis.db': '1',
                'redis.ttl': '3600'
            },
            development: {
                'key': 'value',
                'server.port': '$PORT',
                'server.host': '$HOST',
                'redis.host': 'localhost',
                'redis.port': '6379',
                'redis.db': '1',
                'redis.ttl': '3600',
                'smtp.server': '127.0.0.1',
                'smtp.port': '587',
                'client.routes.defaults.language': 'fr'
            }
        };

    assert.deepEqual(config.sections, expect);
};

exports.testNoInherit = function testNoInherit() {
    var parser = new Parser({
            env: {},
            nativeType: false,
            dotKey: false,
            inherit: false
        }),
        data = fs.readFileSync(__dirname + '/config.ini').toString(),
        config = parser.parse(data),
        expect = {
            production: {
                'server.port': '$PORT',
                'server.host': '$HOST',
                'redis.host': 'x.x.x.x',
                'redis.port': '7468',
                'redis.db': '1',
                'redis.ttl': '3600'
            },
            'development : production': {
                'redis.host': 'localhost',
                'redis.port': '6379',
                'smtp.server': '127.0.0.1',
                'smtp.port': '587',
                'client.routes.defaults.language': 'fr'
            }
        };

    assert.deepEqual(config.sections, expect);
};

exports.testNoEnv = function testNoEnv() {
    var parser = new Parser({
            env: {},
            nativeType: false
        }),
        data = fs.readFileSync(__dirname + '/config.ini').toString(),
        config = parser.parse(data),
        expect = {
            production: {
                key: 'value',
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
                key: 'value',
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

    assert.deepEqual(config.sections, expect);
};

exports.testEnv = function testEnv() {
    var parser = new Parser({
            env: {
                HOST: '127.0.0.1',
                PORT: '3000'
            }
        }),
        data = fs.readFileSync(__dirname + '/config.ini').toString(),
        config = parser.parse(data),
        expect = {
            development: {
                key: 'value',
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
                key: 'value',
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
    assert.deepEqual(config.sections, expect);
};

exports.testDefault = function testDefault() {
    var data = fs.readFileSync(__dirname + '/full.ini', 'utf-8').toString(),
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
            ['line-comment', 'inline comment'],
            ['line-comment', 'inline comment'],
            ['block-comment', 'inline comment']
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
                'key15': '\nval15\n',
                '\nkey16\n': '\nval16\n'
            },
            sections: {
                'section0': {
                    'key0': 'val0',
                    'key1': 'val1"val1"'
                },
                'section1': {
                    'key0': 'val0'
                },
                'section2': {
                    'key0': 'val0'
                },
                'section3': {
                    'key0': 'val0'
                },
                'section 4': {
                    'key0': 'val0'
                },
                '\nsection 5\n': {
                    'key0': 'val0'
                },
                '\nsection 6\n': {
                    'key0': 'val0'
                },
                'section7': {},
                'section8': {},
                'section9': {
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
                    'key15': '\nval15\n',
                    '\nkey16\n': '\nval16\n',
                    'false': false,
                    'true': true,
                    'sfalse': 'false',
                    'strue': 'true',
                    'esca"ped': "esca'ped",
                    'htab': '\t',
                    'cr': '\r',
                    'lf': '\n',
                    'vtab': '\v',
                    'form-feed': '\f',
                    'backspace': '\b',
                    'u00FF': '\u00FF',
                    'u{456}': '\u{456}',
                    'octal': '\111',
                    'text': "some\ttext with\nnew line and unicodes u\u0424u and u\u{201}u and octal o\111o.",
                    'env0': 'VAL0',
                    'env1': 'VAL0',
                    'env2': 'VAL0',
                    'env3': 'VAL0',
                    'text0': 'a value with VAL0 env',
                    'zr': ['deedee'],
                    'ar': ['one', 'three']
                }
            }
        },
        config;

    var fsm = new Parser({
        inherit: false,
        dotKey: false,
        env: {
            VAR0: 'VAL0'
        },
        onComment: function(comment, state) {
            var args = comments.shift();
            assert.deepEqual(args, [state, comment.trim()]);
        }
    });

    config = fsm.parse(data);
    assert.strictEqual(comments.length, 0);
    assert.deepEqual(config, expect);

    // todo: test with new line ${}

    assert.throws(function() {
        fsm.parse(':toto');
    });
    assert.throws(function() {
        fsm.parse('=toto');
    });
    assert.throws(function() {
        fsm.parse(' :toto');
    });
    assert.throws(function() {
        fsm.parse(' =toto');
    });
    assert.throws(function() {
        fsm.parse('"tata"y= toto');
    });
    assert.throws(function() {
        fsm.parse('"tata" y = toto');
    });
    assert.throws(function() {
        fsm.parse('"tata""y" = toto');
    });
    assert.throws(function() {
        fsm.parse('toto = "tata"y');
    });
    assert.throws(function() {
        fsm.parse('toto = "tata" y');
    });
    assert.throws(function() {
        fsm.parse('toto = "tata""y"');
    });
};

describe(__filename.replace(/^(?:.+[\/\\])?([^.\/\\]+)(?:.[^.]+)?$/, '$1'), function() {
    var fn, test;
    for (test in exports) {
        fn = exports[test];
        it(fn.name, fn);
    }
});