/* jshint mocha: true */
/* globals assert: false */

var util = require('util'),
    fs = require('fs'),
    IniConfigParser = require('../'),
    Parser = IniConfigParser.Parser;

exports.testOptionEnv = function testOptionEnv() {
    var data = [
        "user = $user",
        "password = ${password}",
        "missing = $missing",
        "unknown = ${unknown}"
    ].join('\n');

    assert.deepEqual(IniConfigParser.parse(data, {
        env: {
            user: 'name',
            password: 'password'
        }
    }), {
        user: 'name',
        password: 'password',
        missing: '$missing',
        unknown: '${unknown}'
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        env: false
    }), {
        user: '$user',
        password: '${password}',
        missing: '$missing',
        unknown: '${unknown}'
    });
};

exports.testOptionOnEnvNotFound = function testOptionOnEnvNotFound() {
    var data = [
        "user = $user",
        "password = ${password}",
        "missing = $missing",
        "unknown = ${unknown}"
    ].join('\n');

    function onEnvNotFound(variable, str) {
        return '==' + variable + '[' + str + ']' + '==';
    }

    assert.deepEqual(IniConfigParser.parse(data, {
        env: {
            user: 'name',
            password: 'password'
        },
        onEnvNotFound: onEnvNotFound
    }), {
        user: 'name',
        password: 'password',
        missing: '==missing[$missing]==',
        unknown: '==unknown[${unknown}]=='
    });

    // disabling false also disable onEnvNotFound
    assert.deepEqual(IniConfigParser.parse(data, {
        env: false,
        onEnvNotFound: onEnvNotFound
    }), {
        user: '$user',
        password: '${password}',
        missing: '$missing',
        unknown: '${unknown}'
    });
};

exports.testOptionBlockComment = function testOptionBlockComment() {
    // ;;; and ### are the default block comment
    // ; and # are the default line comment
    assert.deepEqual(IniConfigParser.parse([
        ";;;a comment",
        "to ignore;;;",
        "###a comment",
        "to ignore###",
        "user = name ### inline ###",
        "password = password ;;; inline ;;;"
    ].join('\n')), {
        user: 'name',
        password: 'password'
    });


    var data = [
        "***a comment",
        "to ignore***",
        "oui*** =",
        "non***",
        "###a comment",
        "to ignore###",
        "user = name *** inline ***",
        "password = password ;;; inline ;;;"
    ].join('\n');

    // ; and # are the default line comment
    assert.deepEqual(IniConfigParser.parse(data, {
        blockComment: ['***']
    }), {
        'to ignore': '',
        oui: '',
        user: 'name',
        password: 'password'
    });

    // ; and # are the default line comment
    assert.deepEqual(IniConfigParser.parse(data, {
        blockComment: false
    }), {
        "***a comment": '',
        "to ignore***": '',
        "oui***": '',
        "non***": '',
        "to ignore": '',
        "user": 'name *** inline ***',
        "password": 'password'
    });
};

exports.testOptionLineComment = function testOptionLineComment() {
    var data = [
        "user = name; inline",
        "; a comment",
        "# a comment",
        "password = password # inline"
    ].join('\n');

    // ; and # are the default line comment
    assert.deepEqual(IniConfigParser.parse(data), {
        user: 'name',
        password: 'password'
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        lineComment: false
    }), {
        "user": "name; inline",
        "; a comment": "",
        "# a comment": "",
        "password": "password # inline"
    });

    assert.deepEqual(IniConfigParser.parse([
        "user = name; inline",
        "; a comment",
        "// a comment",
        "password = password // inline"
    ].join('\n'), {
        lineComment: ['//']
    }), {
        user: 'name; inline',
        '; a comment': '',
        password: 'password'
    });
};

exports.testOptionAssign = function testOptionAssign() {
    // : and = are the default line comment
    assert.deepEqual(IniConfigParser.parse([
        "user : name; inline",
        "; a comment",
        "# a comment",
        "password = password # inline"
    ].join('\n')), {
        user: 'name',
        password: 'password'
    });

    // # is still a line comment
    assert.deepEqual(IniConfigParser.parse([
        "user := name; inline",
        "; a comment",
        "# a comment",
        "password = password # inline"
    ].join('\n'), {
        assign: [':=']
    }), {
        user: 'name',
        'password = password': ''
    });
};

exports.testOptionNativeType = function testOptionNativeType() {
    var data = [
        "int = 5",
        "scientific = 1e6",
        "float = 1.5",
        "true = true",
        "false = false",
        "sint = '5'",
        "sscientific = '1e6'",
        "sfloat = '1.5'",
        "strue = 'true'",
        "sfalse = 'false'"
    ].join('\n');

    assert.deepEqual(IniConfigParser.parse(data), {
        "int": 5,
        "scientific": 1e6,
        "float": 1.5,
        "true": true,
        "false": false,
        "sint": "5",
        "sscientific": "1e6",
        "sfloat": "1.5",
        "strue": "true",
        "sfalse": "false"
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        nativeType: false
    }), {
        "int": '5',
        "scientific": '1e6',
        "float": '1.5',
        "true": 'true',
        "false": 'false',
        "sint": "5",
        "sscientific": "1e6",
        "sfloat": "1.5",
        "strue": "true",
        "sfalse": "false"
    });
};

exports.testOptionDotKey = function testOptionDotKey() {
    var data = [
        "x.y.z = 5",
        "'a.b.c' = 1e6"
    ].join('\n');

    assert.deepEqual(IniConfigParser.parse(data), {
        x: {
            y: {
                z: 5
            }
        },
        "a.b.c": 1e6
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        dotKey: false
    }), {
        'x.y.z': 5,
        "a.b.c": 1e6
    });
};

exports.testOptionInherit = function testOptionInherit() {
    var data = [
        "key = value",
        "array[] = g0",
        "array[] = g1",

        "[production]",
        "server.host = 127.0.0.1",
        "server.port = xxxx",
        "redis.host = x.x.x.x",
        "redis.port = 9876",
        "redis.db = 1",
        "redis.ttl = 3600",

        "[development : production]",
        "redis.host = localhost",
        "redis.port = 6379",
        "smtp.server = 127.0.0.1",
        "smtp.port = 587",
        "array[] = item0",
        "array[] = item1"
    ].join('\n');

    assert.deepEqual((new Parser()).parse(data), {
        global: {
            key: 'value',
            array: ['g0', 'g1']
        },
        sections: {
            production: {
                key: 'value',
                array: ['g0', 'g1'],
                server: {
                    host: '127.0.0.1',
                    port: 'xxxx'
                },
                redis: {
                    host: 'x.x.x.x',
                    port: 9876,
                    db: 1,
                    ttl: 3600
                }
            },
            development: {
                key: 'value',
                array: ['item0', 'item1'],
                server: {
                    host: '127.0.0.1',
                    port: 'xxxx'
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
                }
            }
        }
    });

    assert.deepEqual((new Parser({
        inherit: false
    })).parse(data), {
        global: {
            key: 'value',
            array: ['g0', 'g1']
        },
        sections: {
            production: {
                server: {
                    host: '127.0.0.1',
                    port: 'xxxx'
                },
                redis: {
                    host: 'x.x.x.x',
                    port: 9876,
                    db: 1,
                    ttl: 3600
                }
            },
            'development : production': {
                redis: {
                    host: 'localhost',
                    port: 6379
                },
                smtp: {
                    server: '127.0.0.1',
                    port: 587
                },
                array: ['item0', 'item1']
            }
        }
    });
};

exports.testOptionArray = function testOptionArray() {
    var data = [
        "er[] =",
        "ar[] = 0",
        "'zr[]' = 0",
        "'[]' = 0",
        "'x.y.z[]' = 0",
        "x.y.z[] = 1",
        "x.y.z[] = 1",
        "x.y.z[] = 2"
    ].join('\n');

    assert.deepEqual(IniConfigParser.parse(data), {
        'er': [''],
        'ar': [0],
        'zr[]': 0,
        '[]': 0,
        'x.y.z[]': 0,
        x: {
            y: {
                z: [1, 1, 2]
            }
        }
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        array: false
    }), {
        'er[]': '',
        'ar[]': 0,
        'zr[]': 0,
        '[]': 0,
        'x.y.z[]': 0,
        x: {
            y: {
                'z[]': 2
            }
        }
    });
};

exports.testOptionString = function testOptionString() {
    // \t \r \n \v \f \uhhhh \u{hhhhh} \<octal>
    var data = fs.readFileSync(__dirname + '/string.ini').toString();

    assert.deepEqual(IniConfigParser.parse(data), {
        'strkey': 'value',
        'strkey ; comment': 'value ; comment',
        'strkey ;;; comment ;;;': 'value ;;; comment ;;;',
        "esca\"ped": 'esca\'ped',
        'htab = \t': '\t',
        'cr =\r': '\r',
        'lf = \n': '\n',
        'vtab = \v': '\v',
        'form-feed = \f': '\f',
        'backspace = \b': '\b',
        '\\u00FF = \u00FF': '\u00FF',
        '\\u{456} = \u{456}': '\u{456}',
        '\\111 = \111': '\111',
        'text': "some\ttext with\nnew line and unicodes u\u0424u and u\u{201}u and octal o\111o"
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        string: false
    }), {
        "'strkey'": "'value'",
        "'strkey": "",
        "'strkey '": "'value '",
        '"esca\"ped"': "'esca\'ped'",
        "'htab": "t' = 't'",
        "'cr": "r' = 'r'",
        "'lf": "n' = 'n'",
        "'vtab": "v' = 'v'",
        "'form-feed": "f' = 'f'",
        "'backspace": "b' = 'b'",
        "'\\u00FF": "u00FF' = 'u00FF'",
        "'\\u{456}": "u{456}' = 'u{456}'",
        "'\\111": "111' = '111'",
        text: '"somettext withnnew line and unicodes uu0424u and uu{201}u and octal o111o"'
    });
};

exports.testOptionMString = function testOptionMString() {
    // \t \r \n \v \f \uhhhh \u{hhhhh} \<octal>
    var data = fs.readFileSync(__dirname + '/mstring.ini').toString();

    assert.deepEqual(IniConfigParser.parse(data), {
        '\nstrkey\n': '\nvalue\n',
        '\nstrkey ; comment\n': '\nvalue ; comment\n',
        '\nstrkey ;;; comment ;;;\n': '\nvalue ;;; comment ;;;\n',
        "\n\"'escaped\"'\n": '\n"\'escaped"\'\n',
        '\nhtab = \t\n': '\n\t\n',
        '\ncr =\r\n': '\n\r\n',
        '\nlf = \n\n': '\n\n\n',
        '\nvtab = \v\n': '\n\v\n',
        '\nform-feed = \f\n': '\n\f\n',
        '\nbackspace = \b\n': '\n\b\n',
        '\n\\u00FF = \u00FF\n': '\n\u00FF\n',
        '\n\\u{456} = \u{456}\n': '\n\u{456}\n',
        '\n\\111 = \111\n': '\n\111\n',
        'text': "\nsome\ttext with\nnew line and unicodes u\u0424u and u\u{201}u and octal o\111o\n"
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        mstring: false
    }), {
        "'''": "",
        "strkey": "",
        "value": "",
        "\"\'escaped\"\'": "",
        '"""': "",
        'htab': 't',
        't': '',
        'cr': 'r',
        'r': '',
        'lf': 'n',
        'n': '',
        'vtab': 'v',
        'v': '',
        'form-feed': 'f',
        'f': '',
        'backspace': 'b',
        'b': '',
        '\\u00FF': 'u00FF',
        'u00FF': '',
        '\\u{456}': 'u{456}',
        'u{456}': '',
        '\\111': '111',
        '111': '',
        'text': '"""',
        'somettext withnnew line and unicodes uu0424u and uu{201}u and octal o111o': ''
    });
};

exports.testExport = function testExport() {
    var file = __dirname + '/config.ini',
        data = fs.readFileSync(file).toString(),
        config = IniConfigParser.parse(data, {
            env: {
                HOST: '127.0.0.1',
                PORT: '3000'
            }
        }),
        expect = {
            key: 'value',
            array: ['g0', 'g1'],
            production: {
                key: 'value',
                array: ['g0', 'g1'],
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
            },
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
                },
                array: ['item0', 'item1'],
                strkey: 'strvalue',
                mstrkey: 'mstrvalue'
            }
        };

    assert.deepEqual(config, expect);

    config = IniConfigParser.parseFile(file, {
        env: {
            HOST: '127.0.0.1',
            PORT: '3000'
        }
    });
    assert.deepEqual(config, expect);
};

exports.testOptionEnv2 = function testOptionEnv2() {
    var parser = new Parser({
            env: {}
        }),
        data = [
            "key = **$value**",
            "brace = **${brace}**",
            'falty = "**${falty\\ns}**"',
            'mstring = """**${falty\ns}**"""',
            "another = **${another}**",
            "notexpanded = '$notexpanded'",
            "notexpanded2 = '${notexpanded}'",
            "notfound0 = \"**$notfound0**\"",
            "notfound1 = \"**${notfound1}**\"",
            "notfound2 = **$notfound2**",
            "notfound3 = **${notfound3}**",
            "nested = **${xxx${value}**",
            "nestedstr = \"**${xxx${value}**\"",
            "nestedw = **${xxx$value**",
            "nestedwstr = \"**${xxx$value**\"",
            "atend = **${atend"
        ].join('\n'),
        config, expect;

    // keep as is when no en found
    config = parser.parse(data);
    expect = {
        key: '**$value**',
        brace: '**${brace}**',
        falty: '**${falty\ns}**',
        mstring: '**${falty\ns}**',
        another: '**${another}**',
        notexpanded: '$notexpanded',
        notexpanded2: '${notexpanded}',
        notfound0: '**$notfound0**',
        notfound1: '**${notfound1}**',
        notfound2: '**$notfound2**',
        notfound3: '**${notfound3}**',
        nested: '**${xxx${value}**',
        nestedstr: '**${xxx${value}**',
        nestedw: '**${xxx$value**',
        nestedwstr: '**${xxx$value**',
        atend: '**${atend'
    };
    assert.deepEqual(config.global, expect);

    // should replace env
    parser = new Parser({
        env: {
            value: 'variable',
            brace: 'braceval',
            another: 'key',
            notexpanded: 'notexpanded',
            atend: 'atend'
        }
    });
    config = parser.parse(data);
    expect = {
        key: '**variable**',
        brace: '**braceval**',
        falty: '**${falty\ns}**',
        mstring: '**${falty\ns}**',
        another: '**key**',
        notexpanded: '$notexpanded',
        notexpanded2: '${notexpanded}',
        notfound0: '**$notfound0**',
        notfound1: '**${notfound1}**',
        notfound2: '**$notfound2**',
        notfound3: '**${notfound3}**',
        nested: '**${xxxvariable**',
        nestedstr: '**${xxxvariable**',
        nestedw: '**${xxxvariable**',
        nestedwstr: '**${xxxvariable**',
        atend: '**${atend'
    };
    assert.deepEqual(config.global, expect);

    // should call onEnvNotFound for not found values
    parser = new Parser({
        env: {
            value: 'variable',
            brace: 'braceval',
            another: 'key',
            notexpanded: 'notexpanded',
            atend: 'atend'
        },
        onEnvNotFound: onEnvNotFound
    });
    config = parser.parse(data);
    expect = {
        key: '**variable**',
        brace: '**braceval**',
        falty: '**${falty\ns}**',
        mstring: '**${falty\ns}**',
        another: '**key**',
        notexpanded: '$notexpanded',
        notexpanded2: '${notexpanded}',
        notfound0: '****',
        notfound1: '****',
        notfound2: '****',
        notfound3: '****',
        nested: '**${xxxvariable**',
        nestedstr: '**${xxxvariable**',
        nestedw: '**${xxxvariable**',
        nestedwstr: '**${xxxvariable**',
        atend: '**${atend'
    };
    assert.deepEqual(config.global, expect);

    // should do nothing if env is disabled
    parser = new Parser({
        env: false,
        onEnvNotFound: onEnvNotFound
    });
    config = parser.parse(data);
    expect = {
        key: '**$value**',
        brace: '**${brace}**',
        falty: '**${falty\ns}**',
        mstring: '**${falty\ns}**',
        another: '**${another}**',
        notexpanded: '$notexpanded',
        notexpanded2: '${notexpanded}',
        notfound0: '**$notfound0**',
        notfound1: '**${notfound1}**',
        notfound2: '**$notfound2**',
        notfound3: '**${notfound3}**',
        nested: '**${xxx${value}**',
        nestedstr: '**${xxx${value}**',
        nestedw: '**${xxx$value**',
        nestedwstr: '**${xxx$value**',
        atend: '**${atend'
    };
    assert.deepEqual(config.global, expect);

    function onEnvNotFound(variable) {
        return '';
    }
};

exports.testEsacpeChar = function testEsacpeChar() {
    var data = "key = val\\ue\nanother = va\\$lue";

    assert.deepEqual(IniConfigParser.parse(data), {
        key: 'value',
        another: 'va$lue'
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        escapeCharValue: false
    }), {
        key: 'val\\ue',
        another: 'va\\$lue'
    });

    assert.deepEqual(IniConfigParser.parse(data, {
        env: false,
        escapeCharValue: false
    }), {
        key: 'val\\ue',
        another: 'va\\$lue'
    });

    assert.deepEqual(IniConfigParser.parse("x\\y\\z = value", {
        escapeCharKey: true
    }), {
        xyz: 'value'
    });

    assert.deepEqual(IniConfigParser.parse("x\\y\\z = value", {
        escapeCharKey: false
    }), {
        'x\\y\\z': 'value'
    });
};

exports.testMissingCoverage = function testMissingCoverage() {
    var parser = new Parser(),
        data = [
            "key = ''",
            "another = ''''''",
            "empty ="
        ].join('\n'),
        config = parser.parse(data),
        expect = {
            key: '',
            another: '',
            empty: ''
        };
    assert.deepEqual(config.global, expect);

    assert.throws(function() {
        IniConfigParser.parse('toto', {
            ignoreMissingAssign: false
        });
    });
    assert.throws(function() {
        IniConfigParser.parse('toto ; =', {
            ignoreMissingAssign: false
        });
    });
    assert.throws(function() {
        IniConfigParser.parse('toto\ntata ; =', {
            ignoreMissingAssign: false
        });
    });

    assert.deepEqual(IniConfigParser.parse([
        '"tata" y = toto',
        '"tata""y" = toto',
    ].join('\n'), {
        ignoreInvalidStringKey: true
    }), {
        '"tata" y': 'toto',
        '"tata""y"': 'toto'
    });

    assert.deepEqual(IniConfigParser.parse([
        'Key = TOTO',
        'aNOTHER = toto',
    ].join('\n'), {
        ignoreCase: true
    }), {
        'key': 'toto',
        'another': 'toto'
    });
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
                    'text': "some\ttext with\nnew line and unicodes u\u0424u and u\u{201}u and octal o\111o",
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

    // assert.throws(function() {
    //     fsm.parse(':toto');
    // });
    // assert.throws(function() {
    //     fsm.parse('=toto');
    // });
    // assert.throws(function() {
    //     fsm.parse(' :toto');
    // });
    // assert.throws(function() {
    //     fsm.parse(' =toto');
    // });
    // assert.throws(function() {
    //     fsm.parse('"tata"y= toto');
    // });
    // assert.throws(function() {
    //     fsm.parse('"tata" y = toto');
    // });
    // assert.throws(function() {
    //     fsm.parse('"tata""y" = toto');
    // });
    // assert.throws(function() {
    //     fsm.parse('toto = "tata"y');
    // });
    // assert.throws(function() {
    //     fsm.parse('toto = "tata" y');
    // });
    // assert.throws(function() {
    //     fsm.parse('toto = "tata""y"');
    // });
};

describe(__filename.replace(/^(?:.+[\/\\])?([^.\/\\]+)(?:.[^.]+)?$/, '$1'), function() {
    var fn, test;
    for (test in exports) {
        fn = exports[test];
        it(fn.name, fn);
        // break;
    }
});