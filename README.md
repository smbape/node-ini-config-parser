sm-init-config-parser
=======

Experimental ini config parser

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
