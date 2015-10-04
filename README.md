ini-config-parser
=======

Parse ini file with nested config overriding made easier (experimental)

config.ini
```ini
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
```

```javascript
var IniConfigParser = require('sm-ini-config-parser');
var assert = require('assert');

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
```

```javascript
var IniConfigParser = require('sm-ini-config-parser');
var assert = require('assert');

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
