# ini-config-parser

Parse ini file with nested config overriding made easier

According to [INI file acticle](https://en.wikipedia.org/wiki/INI_file) on Wikipedia, there are many implementation on ini file parser.
This is an attempt to create a customizable ini parser

## Usage

### IniConfigParser.parse(string, [object])

Parse an ini text with these default options

```coffeescript
defaultOptions =
    merge: true # Return config as merge of global + sections
    env: process.env # Used for variable extension. Set to false to disable variable extension
    blockComment: [';;;', '###'] # Used to delimit block comment. Set to false if you don't want block comment
    lineComment: [';', '#'] # Used to delimit line comment. Set to false if you don't want line comment
    assign: [':', '='] # Define assign symbols
    nativeType: true # Transform boolean and numbers into native type unless quoted
    dotKey: true # Parse `a.b.c = value` as `{a: {b: {c: value}}}` instead of `{'a.b.c': value}` unless quoted
    inherit: true # Enable global and section inheritance. .i.e `[a: b : c : ...]` similar to `_.defaultsDeep(a, b, c)`
    array: true # Parse key[] = value as {key: [value]} instead of {'key[]': 'value'} unless quoted
    string: true # Parse 'key' as a javascript string. i.e decode `\t \r \n \v \f \uhhhh \u{hhhhh} \<octal>`
    mstring: true # Enable multiline strings
    ignoreInvalidStringKey: true # Parse `"tata" y = toto` => `{'"tata" y': 'toto'}` otherwise, throw an error
    ignoreInvalidStringValue: true # `toto = "tata"y` => `{toto: '"tata"y'}`
    emptyValue: '' # Empty value
    escapeCharKey: true # Escape `\` in not quoted key
    escapeCharValue: true # Escape `\` in value in not quoted value
    ignoreMissingAssign: true # Allow keys without assign token
    ignoreCase: false # All keys and values are lower case
```

### IniConfigParser.Parser([object]).parse(string)

Parse an ini text with these default options

```coffeescript
defaultOptions =
    merge: false # Return config as merge of global + sections
    env: process.env # Used for variable extension. Set to false to disable variable extension
    blockComment: [';;;', '###'] # Used to delimit block comment. Set to false if you don't want block comment
    lineComment: [';', '#'] # Used to delimit line comment. Set to false if you don't want line comment
    assign: [':', '='] # Define assign symbols
    nativeType: true # Transform boolean and numbers into native type unless quoted
    dotKey: true # Parse `a.b.c = value` as `{a: {b: {c: value}}}` instead of `{'a.b.c': value}` unless quoted
    inherit: true # Enable global and section inheritance. .i.e `[a: b : c : ...]` similar to `_.defaultsDeep(a, b, c)`
    array: true # Parse key[] = value as {key: [value]} instead of {'key[]': 'value'} unless quoted
    string: true # Parse 'key' as a javascript string. i.e decode `\t \r \n \v \f \uhhhh \u{hhhhh} \<octal>`
    mstring: true # Enable multiline strings
    ignoreInvalidStringKey: true # Parse `"tata" y = toto` => `{'"tata" y': 'toto'}` otherwise, throw an error
    ignoreInvalidStringValue: true # `toto = "tata"y` => `{toto: '"tata"y'}`
    emptyValue: '' # Empty value
    escapeCharKey: true # Escape `\` in not quoted key
    escapeCharValue: true # Escape `\` in value in not quoted value
    ignoreMissingAssign: true # Allow keys without assign token
    ignoreCase: false # All keys and values are lower case
```

## Examples

config.ini

```ini
key = value
array[] = g0
array[] = g1

[production]
server.port = $PORT
server.host = $HOST
redis.host = x.x.x.x
redis.port = 7468
redis.db = 1
redis.ttl = 3600

[development : production]
redis.host = localhost
redis.port = 6379
smtp.server = 127.0.0.1
smtp.port = 587
client.routes.defaults.language = fr
array[] = item0
array[] = item1
'strkey' = 'strvalue'
'''mstrkey''' = '''mstrvalue'''
```

```javascript
var IniConfigParser = require('ini-config-parser'),
    Parser = IniConfigParser.Parser;

var file = __dirname + '/config.ini',
    data = fs.readFileSync(file).toString(),
    config, expect;

config = IniConfigParser.parse(data, {
    env: {
        HOST: '127.0.0.1',
        PORT: '3000'
    }
});

expect = {
    key: 'value',
    array: ['g0', 'g1'],
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
        },
        array: ['g0', 'g1']
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
```

## Seperate global and sections

```javascript
var IniConfigParser = require('ini-config-parser');

var file = __dirname + '/config.ini',
    data = fs.readFileSync(file).toString();

var config = IniConfigParser.Parser({
    env: {
        HOST: '127.0.0.1',
        PORT: '3000'
    }
}).parse(data);

assert.deepEqual(config.global, {
    key: 'value',
    array: ['g0', 'g1']
});

// by default, all sections inherit global properties
assert.deepEqual(config.sections.production, {
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
});

// however global properties can be overrided in sections
assert.deepEqual(config.sections.development, {
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
});

assert.deepEqual(IniConfigParser.parse(data, {
    env: {
        HOST: '127.0.0.1',
        PORT: '3000'
    },
    merge: false
}), config);
```

# Options

## env

```ini
type: object|false
default: process.env
```

Used for variable extension. Set to false to disable variable extension

```javascript
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
```

## onEnvNotFound(variable, str)

```ini
type: function
```

Called when variable is not found

```javascript
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
```

## blockComment

```ini
type: array|false
default: [';;;', '###']
```

Used to delimit block comment. Set to false if you don't want block comment

```javascript
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
```

## lineComment

```ini
type: array|false
default: [';', '#']
```

Used to delimit line comment. Set to false if you don't want line comment

```javascript
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
```

## assign

```ini
type: array
default: [':', '=']
```

Define assign symbols

```javascript
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
```

## nativeType

```ini
type: boolean
default: true
```

Transform boolean and numbers into native type unless quoted

```javascript
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
```

## dotKey

```ini
type: boolean
default: true
```

Parse `a.b.c = value` as `{a: {b: {c: value}}}` instead of `{'a.b.c': value}` unless quoted

```ini
type: boolean
default: true
```

```javascript
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
```

## inherit

```ini
type: boolean
default: true
```

Enable global and section inheritance. .i.e `[a: b : c : ...]` similar to `_.defaultsDeep(a, b, c)`

```javascript
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
```

## array

```ini
type: boolean
default: true
```

Parse `key[] = value` as `{key: [value]}` instead of `{'key[]': 'value'}` unless quoted

```javascript
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
```

## string

```ini
type: boolean
default: true
```

Parse 'key' as a javascript string. i.e decode `\t \r \n \v \f \uhhhh \u{hhhhh} \<octal>`

string.ini

```ini
'strkey' = 'value'
'strkey ; comment' = 'value ; comment'
'strkey ;;; comment ;;;' = 'value ;;; comment ;;;'
"esca\"ped" = 'esca\'ped'
'htab = \t' = '\t'
'cr =\r' = '\r'
'lf = \n' = '\n'
'vtab = \v' = '\v'
'form-feed = \f' = '\f'
'backspace = \b' = '\b' ###
completely ignored
###
'\\u00FF = \u00FF' = '\u00FF'
'\\u{456} = \u{456}' = '\u{456}'
'\\111 = \111' = '\111'; ignored
text = "some\ttext with\nnew line and unicodes u\u0424u and u\u{201}u and octal o\111o"
```

```javascript
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
```

## mstring

```ini
type: boolean
default: true
```

Enable multiline strings

mstring.ini

```ini
'''
strkey
''' = '''
value
'''

'''
strkey ; comment
''' = '''
value ; comment
'''

'''
strkey ;;; comment ;;;
''' = '''
value ;;; comment ;;;
'''

"""
\"\'escaped"'
""" = '''
\"\'escaped"'
'''

'''
htab = \t
''' = '''
\t
'''

'''
cr =\r
''' = '''
\r
'''

'''
lf = \n
''' = '''
\n
'''

'''
vtab = \v
''' = '''
\v
'''

'''
form-feed = \f
''' = '''
\f
'''

'''
backspace = \b
''' = '''
\b
''' ###
completely ignored
###

'''
\\u00FF = \u00FF
''' = '''
\u00FF
'''

'''
\\u{456} = \u{456}
''' = '''
\u{456}
'''

'''
\\111 = \111
''' = '''
\111
'''; ignored

text = """
some\ttext with\nnew line and unicodes u\u0424u and u\u{201}u and octal o\111o
"""
```

```javascript
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
```

## ignoreInvalidStringKey

```ini
type: boolean
default: true
```

Parse `"tata" y = toto` => `{'"tata" y': 'toto'}` otherwise, throw an error

```javascript
assert.deepEqual(IniConfigParser.parse([
    '"tata" y = toto',
    '"""tata"""y = toto'
].join('\n')), {
    '"tata" y': 'toto',
    '"""tata"""y': 'toto'
});

assert.throws(function() {
    IniConfigParser.parse('"tata" y = toto', {
        ignoreInvalidStringKey: false
    });
});

assert.throws(function() {
    IniConfigParser.parse('"""tata"""y = toto', {
        ignoreInvalidStringKey: false
    });
});
```

## ignoreInvalidStringValue

```ini
type: boolean
default: true
```

Parse `"tata" y = toto` => `{'"tata" y': 'toto'}` otherwise, throw an error

```javascript
assert.deepEqual(IniConfigParser.parse([
    'toto = "tata"y',
    'titi = """tata"""y'
].join('\n')), {
    'toto': '"tata"y',
    'titi': '"""tata"""y'
});

assert.throws(function() {
    IniConfigParser.parse('toto = "tata"y', {
        ignoreInvalidStringValue: false
    });
});

assert.throws(function() {
    IniConfigParser.parse('titi = """tata"""y', {
        ignoreInvalidStringValue: false
    });
});
```
## emptyValue

```ini
type: boolean
default: true
```

Empty value

```javascript
assert.deepEqual(IniConfigParser.parse([
    'host ='
].join('\n'), {
    emptyValue: 'value'
}), {
    'host': 'value'
});
```

## escapeCharKey

```ini
type: boolean
default: true
```

Escape `\` in not quoted key

```javascript
var data = 'ho\\st = 127.0.0.1';

assert.deepEqual(IniConfigParser.parse(data), {
    'host': '127.0.0.1'
});

assert.deepEqual(IniConfigParser.parse(data, {
    escapeCharKey: false
}), {
    'ho\\st': '127.0.0.1'
});
```

## escapeCharValue

```ini
type: boolean
default: true
```

Escape `\` in value in not quoted value

```javascript
var data = [
    'host = 127.0\\.0.1',
    'port = $port',
    'eport = \\$port'
].join('\n');

assert.deepEqual(IniConfigParser.parse(data, {
    env: {
        port: 1234
    }
}), {
    'host': '127.0.0.1',
    'port': 1234,
    'eport': '$port'
});

assert.deepEqual(IniConfigParser.parse(data, {
    env: {
        port: 1234
    },
    escapeCharValue: false
}), {
    'host': '127.0\\.0.1',
    'port': 1234,
    'eport': '\\1234'
});
```

## ignoreMissingAssign

```ini
type: boolean
default: true
```

Allow keys without assign token

```javascript
var data = [
    'host = ',
    'port'
].join('\n');

assert.deepEqual(IniConfigParser.parse(data), {
    'host': '',
    'port': ''
});

assert.throws(function() {
    IniConfigParser.parse(data, {
        ignoreMissingAssign: false
    });
});
```

## ignoreCase

```ini
type: boolean
default: false
```

All keys and values are lower case

```javascript
assert.deepEqual(IniConfigParser.parse([
    'host = HOST',
    'PORT = 5678',
    '"SHAFT" = "5678"'
].join('\n'), {
    ignoreCase: true
}), {
    'host': 'host',
    'port': 5678,
    'shaft': '5678'
});
```

## merge

```ini
type: boolean
default: false
```

Return config as merge of global + sections

```javascript
assert.deepEqual(IniConfigParser.parse([
    'host = 127.0\\.0.1'
].join('\n')), {
    'host': '127.0.0.1'
});

assert.deepEqual(IniConfigParser.parse([
    'host = 127.0\\.0.1'
].join('\n'), {
    merge: false
}), {
    'host': '127.0\\.0.1'
});
```

# License

The MIT License (MIT)

Copyright (c) 2014-2015 Stéphane MBAPE (http://smbape.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
