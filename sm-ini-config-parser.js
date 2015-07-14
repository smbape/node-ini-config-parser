var fs = require('fs'),
    ini = require('ini');

function extend(dst, src) {
    if (null === dst || 'object' !== typeof dst || null === src || 'object' !== typeof src) {
        return dst;
    }

    for (var key in src) {
        dst[key] = src[key];
    }
}

function parseFlat(config, coerce) {
    var i, key, next, properties, property, value, _len, parsedConfig = {};
    for (key in config) {
        if ('function' === typeof coerce) {
            value = coerce(config[key]);
        } else {
            value = config[key];
        }

        properties = key.split('.');
        _len = properties.length
        if (_len < 2) {
            parsedConfig[key] = value;
            continue;
        }

        next = parsedConfig;
        for (i = 0; i < _len; i++) {
            property = properties[i];
            if (i === _len - 1) {
                next[property] = value;
                break;
            }
            if (!next.hasOwnProperty(property)) {
                next[property] = {};
            }
            next = next[property];
        }
    }

    return parsedConfig;
}

function parse(filePath, coerce) {
    var child, configs, index, parent, section, sections, _len;
    configs = ini.parse(fs.readFileSync(filePath, 'utf-8'));

    for (section in configs) {
        if (!/\s*:\s*/.test(section)) {
            continue;
        }
        sections = section.split(/\s*:\s*/);
        child = sections[0];
        configs[child] = {};
        for (index = 1, _len = sections.length; index < _len; index++) {
            parent = sections[index];
            if (!configs.hasOwnProperty(parent)) {
                continue;
            }
            extend(configs[child], configs[parent]);
        }
        extend(configs[child], configs[section]);
        delete configs[section];
    }

    for (section in configs) {
        configs[section] = parseFlat(configs[section], coerce);
    }

    return configs;
}

function isObject(value) {
    // Avoid a V8 JIT bug in Chrome 19-20.
    // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
    var type = typeof value;
    return type == 'function' || (value && type == 'object') || false;
}

function parser(registry) {
    if (!isObject(registry) || 'function' !== typeof registry.has || 'function' !== typeof registry.get) {
        registry = {
            has: function() {
                return false;
            }
        };
    }

    var coerce = function(value) {
        if ('string' !== typeof value || value.length === 0) {
            return value;
        }
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
        if (!isNaN(value)) {
            return parseFloat(value);
        }
        value = value.replace(/\$([\w\$]+)/g, function(match, variable, index, str) {
            if (variable === '$') {
                return variable;
            }
            if (registry.has(variable)) {
                return registry.get(variable);
            }
            if (process.env.hasOwnProperty(variable)) {
                return process.env[variable];
            }
            return '';
        });

        return value.length === 0 ? null : value;
    };

    return function(filePath) {
        return parse(filePath, coerce);
    };
}

parser.parse = parse;
module.exports = parser;