var fs = require('fs'),
    ini = require('ini'),
    _ = require('lodash');

function parseFlat(config, coerce) {
    var i, key, next, properties, property, value, _i, _len;
    for (key in config) {
        if ('function' === typeof coerce) {
            value = coerce(config[key]);
        } else {
            value = config[key];
        }
        properties = key.split('.');
        if (properties.length < 2) {
            continue;
        }
        next = config;
        delete config[key];
        for (i = _i = 0, _len = properties.length; _i < _len; i = ++_i) {
            property = properties[i];
            if (i === properties.length - 1) {
                next[property] = value;
                break;
            }
            if (!next.hasOwnProperty(property)) {
                next[property] = {};
            }
            next = next[property];
        }
        next = null;
    }
};

function parse(filePath, coerce) {
    var config;
    var child, config, index, parent, section, sections, _i, _ref;
    config = ini.parse(fs.readFileSync(filePath, 'utf-8'));
    for (section in config) {
        if (!/\s*:\s*/.test(section)) {
            continue;
        }
        sections = section.split(/\s*:\s*/);
        child = sections[0];
        config[child] = {};
        for (index = _i = 1, _ref = sections.length; _i < _ref; index = _i += 1) {
            parent = sections[index];
            if (!config.hasOwnProperty(parent)) {
                continue;
            }
            _.extend(config[child], config[parent]);
        }
        _.extend(config[child], config[section]);
        delete config[section];
    }
    for (section in config) {
        parseFlat(config[section], coerce);
    }
    return config;
};

module.exports = {
    parse: parse
};