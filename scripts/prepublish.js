var sysPath = require("path");
var rimraf = require("rimraf");
rimraf(sysPath.join(__dirname, "../lib"), function(err) {
    if (err) {
        throw err;
    }

    require("coffee-script/bin/coffee");
});