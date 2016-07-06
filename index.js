// require('coffee-script').register();
var fs = require('fs'),
    Parser = require('./lib/Parser');

exports.Parser = Parser;

exports.parseFile = function(file, options) {
    var str = fs.readFileSync(file).toString();
    return exports.parse(str, options);
}

exports.parse = function(str, options) {
    var defaultOptions = {
        merge: true
    };

    if (options == null) {
        options = defaultOptions;
    } else if (!options.hasOwnProperty('merge')) {
        options.merge = defaultOptions.merge;
    }

    var parser = new Parser(options);
    return parser.parse(str);
}
