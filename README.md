# ini-config-parser

Parse ini file with nested config overriding made easier

According to [INI file acticle](https://en.wikipedia.org/wiki/INI_file) on Wikipedia, there are many implementation on ini file parser.
This is an attempt to create a customizable ini parser

## Usage

### parse(string, [object])

Parse an ini text with these options

```coffeescript
defaultOptions =
    env: process.env # used for variable extension
    blockComment: [';;;', '###'] # used to delimit block comment. Set to false if you don't want block comment
    lineComment: [';', '#'] # used to delimit line comment. Set to false if you don't want line comment
    assign: [':', '='] # used to set assign sign
    nativeType: true # will transform boolean and numbers into native type when not quoted
    dotKey: true # a.b.c = value will be parse as '{a: {b: {c: value}}}' instead of ['a.b.c'] = value
    inherit: true # enable section inheritance. [a: b : c : ...]. similar to _.defaults(a, b, c)
    array: true # parse key[] = value as {key: [value]} instead of {'key[]': 'value'}
    string: true # parse 'key' as a javascript string. i.e '\t\r\n\v\f\uhhhh\u{hhhhh}'
    mstring: true # enable multiline strings
    merge: true # return config as merge of global + sections
    escapeCharKey: true # escap \ in key
    escapeCharValue: true # escap \ in value and expand env
    emptyValue: '' # empty value
    ignoreMissingAssign: true # allow keys without assign token 
    ignoreInvalidStringKey: false # "tata" y = toto => {'"tata" y': 'toto'}
    ignoreCase: false # all keys and values are lower case
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
var Parser = require('ini-config-parser').Parser;
var parser = new Parser();
config = parser.parse(data);

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

```

# Options

## env

```ini
type: object|false
default: process.env
```

Used for variable extension. Set to false to disable variable extension

```javascript
assert.deepEqual(IniConfigParser.parse([
    "user = $user",
    "password = ${password}",
    "missing = $missing",
    "unknown = ${unknown}"
].join('\n'), {
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

assert.deepEqual(IniConfigParser.parse([
    "user = $user",
    "password = ${password}",
    "missing = $missing",
    "unknown = ${unknown}"
].join('\n'), {
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
function onEnvNotFound(variable, str) {
    return '==' + variable + '[' + str + ']' + '==';
}

assert.deepEqual(IniConfigParser.parse([
    "user = $user",
    "password = ${password}",
    "missing = $missing",
    "unknown = ${unknown}"
].join('\n'), {
    env: {
        user: 'name',
        password: 'password'
    },
    onEnvNotFound
}), {
    user: 'name',
    password: 'password',
    missing: '==missing[$missing]==',
    unknown: '==unknown[${unknown}]=='
});

// disabling false also disable onEnvNotFound
assert.deepEqual(IniConfigParser.parse([
    "user = $user",
    "password = ${password}",
    "missing = $missing",
    "unknown = ${unknown}"
].join('\n'), {
    env: false,
    onEnvNotFound
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


// ; and # are the default line comment
assert.deepEqual(IniConfigParser.parse([
    "***a comment",
    "to ignore***",
    "oui*** =",
    "non***",
    "###a comment",
    "to ignore###",
    "user = name *** inline ***",
    "password = password ;;; inline ;;;"
].join('\n'), {
    blockComment: ['***']
}), {
    'to ignore': '',
    oui: '',
    user: 'name',
    password: 'password'
});

// ; and # are the default line comment
assert.deepEqual(IniConfigParser.parse([
    "***a comment",
    "to ignore***",
    "oui*** =",
    "non***",
    "###a comment",
    "to ignore###",
    "user = name *** inline ***",
    "password = password ;;; inline ;;;"
].join('\n'), {
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
// ; and # are the default line comment
assert.deepEqual(IniConfigParser.parse([
    "user = name; inline",
    "; a comment",
    "# a comment",
    "password = password # inline"
].join('\n')), {
    user: 'name',
    password: 'password'
});

// # is still a line comment
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

// ; and # are the default line comment
assert.deepEqual(IniConfigParser.parse([
    "user = name; inline",
    "; a comment",
    "# a comment",
    "password = password # inline"
].join('\n'), {
    lineComment: false
}), {
    "user": "name; inline",
    "; a comment": "",
    "# a comment": "",
    "password": "password # inline"
});
```

License
-------
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
