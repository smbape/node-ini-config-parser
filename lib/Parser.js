var OCTAL_REG, Parser, UNICODE_REG, deepExtend, defaultOptions, has, isNumeric, makeError, makeExpectingError, makeSynthaxError, quoteRegMap, specialCharMap, specialReg, unshift,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

has = {}.hasOwnProperty;

unshift = [].unshift;

deepExtend = require('deep-extend');

makeExpectingError = function(actual, expected, pos, code) {
  var err, msg;
  if (code == null) {
    code = 'EXPECTED';
  }
  msg = "Excpecting " + expected + ". Instead get " + actual + ".";
  err = makeSynthaxError(msg, pos, code);
  return err;
};

makeSynthaxError = function(msg, pos, code) {
  var err;
  err = makeError(msg, code, pos, SyntaxError);
  return err;
};

makeError = function(msg, code, pos, clazz) {
  var err;
  if (clazz == null) {
    clazz = Error;
  }
  if (pos) {
    msg += ' At position ' + pos;
  }
  err = new clazz(msg);
  if (code) {
    err.code = code;
  }
  return err;
};

isNumeric = function(obj) {
  return !Array.isArray(obj) && (obj - parseFloat(obj) + 1) >= 0;
};

specialReg = new RegExp('([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g');

specialCharMap = {
  '\\t': '\t',
  '\\r': '\r',
  '\\n': '\n',
  '\\v': '\v',
  '\\f': '\f',
  '\\b': '\b'
};

quoteRegMap = {
  "'": /[^\r\n\\](')|[\r\n]/g,
  '"': /[^\r\n\\](")|[\r\n]/g,
  "'''": /[^\\](''')/g,
  '"""': /[^\\](""")/g
};

OCTAL_REG = /^\\([0-7]{1,3})/g;

UNICODE_REG = /^\\u(?:([0-9a-fA-F]{4,5})|\{([0-9a-fA-F]{1,5})\})/g;

defaultOptions = {
  merge: false,
  env: process.env,
  blockComment: [';;;', '###'],
  lineComment: [';', '#'],
  assign: [':', '='],
  nativeType: true,
  dotKey: true,
  inherit: true,
  array: true,
  string: true,
  mstring: true,
  ignoreInvalidStringKey: true,
  ignoreInvalidStringValue: true,
  emptyValue: '',
  escapeCharKey: true,
  escapeCharValue: true,
  ignoreMissingAssign: true,
  ignoreCase: false
};

Parser = (function() {
  function Parser(options) {
    var i, j, k, l, len1, len2, len3, len4, m, prop, ref, ref1, ref2, ref3, symbol;
    if (options == null) {
      options = {};
    }
    if (!(this instanceof Parser)) {
      return new Parser(options);
    }
    this.options = {};
    for (prop in defaultOptions) {
      this.options[prop] = has.call(options, prop) ? options[prop] : defaultOptions[prop];
    }
    ref = ['onComment', 'onEnvNotFound'];
    for (j = 0, len1 = ref.length; j < len1; j++) {
      prop = ref[j];
      if (has.call(options, prop) && 'function' === typeof options[prop]) {
        this[prop] = options[prop];
      }
    }
    if (this.options.blockComment) {
      this.blockCommentSymbolEscaped = [];
      ref1 = this.options.blockComment;
      for (i = k = 0, len2 = ref1.length; k < len2; i = ++k) {
        symbol = ref1[i];
        this.blockCommentSymbolEscaped[i] = this.escapeReg(symbol);
      }
      this.blockCommentRegSymbol = new RegExp(this.blockCommentSymbolEscaped.join('|'), 'g');
    }
    if (this.options.lineComment) {
      this.lineCommentSymbolEscaped = [];
      ref2 = this.options.lineComment;
      for (i = l = 0, len3 = ref2.length; l < len3; i = ++l) {
        symbol = ref2[i];
        this.lineCommentSymbolEscaped[i] = this.escapeReg(symbol);
      }
      this.lineCommentRegSymbol = new RegExp(this.lineCommentSymbolEscaped.join('|'), 'g');
    }
    this.assignSymbolEscaped = [];
    ref3 = this.options.assign;
    for (i = m = 0, len4 = ref3.length; m < len4; i = ++m) {
      symbol = ref3[i];
      this.assignSymbolEscaped[i] = this.escapeReg(symbol);
    }
    this.commentOrNewLineRegSymbol = ['[\\r\\n]', '$'];
    this.assignOrLfOrCommentRegSymbol = ['[\\r\\n]'];
    if (this.lineCommentSymbolEscaped) {
      unshift.apply(this.commentOrNewLineRegSymbol, this.lineCommentSymbolEscaped);
      unshift.apply(this.assignOrLfOrCommentRegSymbol, this.lineCommentSymbolEscaped);
    }
    if (this.blockCommentSymbolEscaped) {
      unshift.apply(this.commentOrNewLineRegSymbol, this.blockCommentSymbolEscaped);
      unshift.apply(this.assignOrLfOrCommentRegSymbol, this.blockCommentSymbolEscaped);
    }
    unshift.apply(this.assignOrLfOrCommentRegSymbol, this.assignSymbolEscaped);
    this.commentOrNewLineRegSymbol = new RegExp(this.commentOrNewLineRegSymbol.join('|'), 'mg');
    this.assignOrLfOrCommentRegSymbol = new RegExp(this.assignOrLfOrCommentRegSymbol.join('|'), 'mg');
  }

  Parser.prototype.parse = function(input) {
    var config;
    this.input = input;
    this.len = this.input.length;
    this.pos = 0;
    config = {
      global: {},
      sections: {}
    };
    this.config(config);
    this.mustEnd();
    if (this.options.inherit) {
      config = this.inherit(config);
    }
    if (this.options.merge) {
      config = deepExtend(config.global, config.sections);
    }
    return config;
  };

  Parser.prototype.config = function(config) {
    var global, keyValue, newSection, section, sections;
    global = config.global, sections = config.sections;
    while (!(section = this.maybeSection()) && (keyValue = this.expectEofOrKeyValue())) {
      this.set(global, keyValue);
    }
    if (section) {
      sections[section] || (sections[section] = {});
      while (newSection = this.maybeSection()) {
        section = newSection;
        sections[section] || (sections[section] = {});
      }
      while (keyValue = this.expectEofOrKeyValue()) {
        this.set(sections[section], keyValue);
        while (newSection = this.maybeSection()) {
          section = newSection;
          sections[section] || (sections[section] = {});
        }
      }
    }
    return config;
  };

  Parser.prototype.set = function(obj, arg) {
    var i, isArray, isStringKey, j, key, len, properties, ref, value;
    key = arg[0], value = arg[1], isArray = arg[2], isStringKey = arg[3];
    if (!isStringKey && this.options.dotKey) {
      properties = key.split('.');
      len = properties.length;
      if (len > 1) {
        for (i = j = 0, ref = len - 1; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
          key = properties[i];
          if (key === '') {
            throw makeSynthaxError('Empty key', this.pos, 'KEY');
          }
          if (!has.call(obj, key)) {
            obj[key] = {};
          }
          obj = obj[key];
        }
        key = properties[len - 1];
      }
    }
    if (isArray) {
      obj[key] || (obj[key] = []);
      return obj[key].push(value);
    } else {
      return obj[key] = value;
    }
  };

  Parser.prototype.escapeReg = function(str) {
    return str.replace(specialReg, '\\$1');
  };

  Parser.prototype.coerceValue = function(str) {
    var __, _keyEnd, _keyStart, escaped, keyStart, lastIndex, match, re, res, variable;
    lastIndex = 0;
    if (this.options.escapeCharValue) {
      if (this.options.env) {
        re = /\\(.)|\$(\w+)|(\$\{)|(\})/g;
      } else {
        re = /\\(.)/g;
      }
    } else if (this.options.env) {
      re = /($[^$])|\$(\w+)|(\$\{)|(\})/g;
    } else {
      return str;
    }
    res = [];
    while (match = re.exec(str)) {
      __ = match[0], escaped = match[1], variable = match[2], _keyStart = match[3], _keyEnd = match[4];
      if (escaped) {
        if (lastIndex !== match.index) {
          res.push(str.substring(lastIndex, match.index));
        }
        res.push(escaped);
        lastIndex = re.lastIndex;
      } else if (variable) {
        if (lastIndex !== match.index) {
          res.push(str.substring(lastIndex, match.index));
        }
        if (has.call(this.options.env, variable)) {
          variable = this.options.env[variable];
        } else if (this.onEnvNotFound) {
          variable = this.onEnvNotFound(variable, __);
        } else {
          variable = __;
        }
        res.push(variable);
        lastIndex = re.lastIndex;
      } else if (_keyEnd && keyStart) {
        variable = str.substring(keyStart, match.index);
        if (has.call(this.options.env, variable)) {
          variable = this.options.env[variable];
        } else if (this.onEnvNotFound) {
          variable = this.onEnvNotFound(variable, str.substring(lastIndex, re.lastIndex));
        } else {
          variable = str.substring(lastIndex, re.lastIndex);
        }
        res.push(variable);
        lastIndex = re.lastIndex;
        keyStart = null;
      } else if (_keyStart) {
        keyStart = re.lastIndex;
        if (lastIndex !== match.index) {
          res.push(str.substring(lastIndex, match.index));
        }
        lastIndex = match.index;
      }
    }
    if (lastIndex) {
      if (lastIndex < str.length) {
        res.push(str.substring(lastIndex));
      }
      if (res.length === 1) {
        return res[0];
      }
      return res.join('');
    }
    return str;
  };

  Parser.prototype.coerceString = function(str, symbol) {
    var __, _keyEnd, _keyStart, escaped, keyStart, lasIndex, lastIndex, lf, match, octal, re, res, substr, unicode, variable;
    lasIndex = 0;
    if (this.options.env && (symbol === '"""' || symbol === '"')) {
      re = /\\(.)|\$(\w+)|(\$\{)|(\})|([\r\n])/g;
    } else {
      re = /\\(.)/g;
    }
    res = [];
    while (match = re.exec(str)) {
      __ = match[0], escaped = match[1], variable = match[2], _keyStart = match[3], _keyEnd = match[4], lf = match[5];
      if (escaped) {
        if (keyStart) {
          keyStart = null;
        }
        if (lastIndex !== match.index) {
          res.push(str.substring(lastIndex, match.index));
        }
        substr = str.substring(match.index, match.index + 7);
        OCTAL_REG.lastIndex = 0;
        UNICODE_REG.lastIndex = 0;
        if (octal = OCTAL_REG.exec(substr)) {
          re.lastIndex = match.index + OCTAL_REG.lastIndex;
          octal = parseInt(octal[1], 8);
          octal = String.fromCharCode(octal);
          res.push(octal);
        } else if (escaped === 'u') {
          if (unicode = UNICODE_REG.exec(substr)) {
            re.lastIndex = match.index + UNICODE_REG.lastIndex;
            unicode = parseInt(unicode[1] || unicode[2], 16);
            unicode = String.fromCodePoint(unicode);
            res.push(unicode);
          } else {
            throw makeSynthaxError('Invalid Unicode escape sequence', this.pos, 'UNICODE');
          }
        } else {
          res.push(specialCharMap[__] || escaped);
        }
        lastIndex = re.lastIndex;
      } else if (variable) {
        if (keyStart) {
          keyStart = null;
        }
        if (lastIndex !== match.index) {
          res.push(str.substring(lastIndex, match.index));
        }
        if (has.call(this.options.env, variable)) {
          variable = this.options.env[variable];
        } else if (this.onEnvNotFound) {
          variable = this.onEnvNotFound(variable, __);
        } else {
          variable = __;
        }
        res.push(variable);
        lastIndex = re.lastIndex;
      } else if (_keyEnd && keyStart) {
        variable = str.substring(keyStart, match.index);
        if (has.call(this.options.env, variable)) {
          variable = this.options.env[variable];
        } else if (this.onEnvNotFound) {
          variable = this.onEnvNotFound(variable, str.substring(lastIndex, re.lastIndex));
        } else {
          variable = str.substring(lastIndex, re.lastIndex);
        }
        res.push(variable);
        lastIndex = re.lastIndex;
        keyStart = null;
      } else if (_keyStart) {
        keyStart = re.lastIndex;
        if (lastIndex !== match.index) {
          res.push(str.substring(lastIndex, match.index));
        }
        lastIndex = match.index;
      } else if (keyStart && lf) {
        res.push(str.substring(lastIndex, re.lastIndex));
        lastIndex = re.lastIndex;
        keyStart = null;
      }
    }
    if (lastIndex) {
      if (lastIndex < str.length) {
        res.push(str.substring(lastIndex));
      }
      return res.join('');
    }
    return str;
  };

  Parser.prototype.maybe = function(symbol, all) {
    var len, pos;
    if (all) {
      pos = this.input.indexOf(symbol, this.pos);
      if (-1 !== pos) {
        this.pos = pos + symbol.length;
        return symbol;
      }
    } else {
      len = symbol.length;
      if (len === 1) {
        if (symbol === this.input[this.pos]) {
          this.pos++;
          return symbol;
        }
      } else if (symbol === this.input.substring(this.pos, this.pos + len)) {
        this.pos += len;
        return symbol;
      }
    }
  };

  Parser.prototype.maybeRegExp = function(symbol, all) {
    var lasIndex, match;
    lasIndex = symbol.lastIndex;
    if (all) {
      symbol.lastIndex = this.pos;
      match = symbol.exec(this.input);
      if (match) {
        this.pos = symbol.lastIndex;
        symbol.lastIndex = lasIndex;
      }
      return match;
    }
    if (symbol.test(this.input[this.pos])) {
      symbol.lastIndex = lasIndex;
      return this.input[this.pos++];
    }
  };

  Parser.prototype.mustEnd = function() {
    if (this.pos !== this.input.length) {
      throw makeUnExpectingError(this.input[this.pos], this.pos);
    }
    return true;
  };

  Parser.prototype.eatSpace = function() {
    var match, pos;
    pos = this.pos;
    if (match = this.maybeRegExp(/[\S\r\n]/g, true)) {
      this.pos = match.index;
    } else {
      this.pos = this.len;
    }
    return pos !== this.pos;
  };

  Parser.prototype.eatAllSpaces = function() {
    var match, pos;
    pos = this.pos;
    if (match = this.maybeRegExp(/[\S]/g, true)) {
      this.pos = match.index;
    } else {
      this.pos = this.len;
    }
    return pos !== this.pos;
  };

  Parser.prototype.eatComment = function() {
    var commentStart, j, k, len1, len2, match, ref, ref1, symbol;
    if (this.options.blockComment) {
      ref = this.options.blockComment;
      for (j = 0, len1 = ref.length; j < len1; j++) {
        symbol = ref[j];
        if (this.maybe(symbol)) {
          commentStart = this.pos;
          if (!this.maybe(symbol, true)) {
            throw makeExpectingError('[EOF]', symbol, this.pos);
          }
          if (this.onComment) {
            this.onComment(this.input.substring(commentStart, this.pos - symbol.length), 'block-comment');
          }
          return true;
        }
      }
    }
    if (this.options.lineComment) {
      ref1 = this.options.lineComment;
      for (k = 0, len2 = ref1.length; k < len2; k++) {
        symbol = ref1[k];
        if (this.maybe(symbol)) {
          commentStart = this.pos;
          match = this.maybeRegExp(/\r?\n|\r|$/g, true);
          this.pos = match.index;
          if (this.onComment) {
            this.onComment(this.input.substring(commentStart, match.index), 'line-comment');
          }
          return true;
        }
      }
    }
  };

  Parser.prototype.maybeString = function(type) {
    var backup, j, len1, match, ref, str, strEnd, strStart, symbol;
    backup = this.pos;
    if (this.options.mstring) {
      ref = ['"""', "'''"];
      for (j = 0, len1 = ref.length; j < len1; j++) {
        symbol = ref[j];
        if (this.maybe(symbol)) {
          if (this.maybe(symbol)) {
            return '';
          }
          strStart = this.pos;
          match = this.maybeRegExp(quoteRegMap[symbol], true);
          if (match && match[1] === symbol) {
            strEnd = match.index + 1;
            str = this.input.substring(strStart, strEnd);
            return this.coerceString(str, symbol);
          }
          if (this.options['ignoreInvalidString' + type]) {
            this.pos = backup;
          } else {
            throw makeExpectingError(match, symbol, this.pos);
          }
        }
      }
    }
    if (this.options.string) {
      if (symbol = this.maybeRegExp(/['"]/g)) {
        if (this.maybe(symbol)) {
          return '';
        }
        strStart = this.pos;
        match = this.maybeRegExp(quoteRegMap[symbol], true);
        if (match && match[1] === symbol) {
          strEnd = match.index + 1;
          str = this.input.substring(strStart, strEnd);
          return this.coerceString(str, symbol);
        }
        if (this.options['ignoreInvalidString' + type]) {
          this.pos = backup;
        } else {
          throw makeExpectingError(match, symbol, this.pos);
        }
      }
    }
  };

  Parser.prototype.eatSpaceAndComment = function() {
    while (this.eatSpace() || this.eatComment()) {
      continue;
    }
  };

  Parser.prototype.eatAllSpacesAndComment = function() {
    while (this.eatAllSpaces() || this.eatComment()) {
      continue;
    }
  };

  Parser.prototype.expectEofOrKeyValue = function() {
    var backup, hasAssign, hasBlockComment, isArray, isStringKey, key, keyEnd, keyLen, keyStart, lastIndex, match, symbol, value, valueEnd, valueStart;
    this.eatAllSpacesAndComment();
    if (this.pos >= this.len) {
      return;
    }
    keyStart = this.pos;
    if ((key = this.maybeString('Key')) || key === '') {
      isStringKey = true;
      this.eatSpaceAndComment();
      if (!(symbol = this.maybeRegExp(this.assignOrLfOrCommentRegSymbol))) {
        if (this.options.ignoreInvalidStringKey) {
          key = null;
          this.pos = keyStart;
        } else {
          throw makeSynthaxError('Invalid string', this.pos, 'INVALID_STRING');
        }
      }
    }
    if (!symbol) {
      match = this.maybeRegExp(this.assignOrLfOrCommentRegSymbol, true);
      if (match) {
        symbol = match[0];
        keyEnd = match.index;
      } else if (this.options.ignoreMissingAssign) {
        symbol = '';
        keyEnd = this.pos = this.len;
      } else {
        throw makeExpectingError(symbol, this.options.assign, this.pos);
      }
    }
    hasBlockComment = false;
    if (this.options.lineComment && indexOf.call(this.options.lineComment, symbol) >= 0) {
      if (this.options.ignoreMissingAssign) {
        this.pos = match.index;
      } else {
        throw makeExpectingError(symbol, this.options.assign, this.pos);
      }
    } else if (this.options.blockComment && indexOf.call(this.options.blockComment, symbol) >= 0) {
      hasBlockComment = true;
      this.pos = match.index;
    } else if (/[\r\n]/.test(symbol)) {
      if (this.options.ignoreMissingAssign) {
        this.pos = match.index;
      } else {
        throw makeExpectingError(symbol, this.options.assign, this.pos);
      }
    }
    if (!key && key !== '') {
      key = this.input.substring(keyStart, keyEnd);
      if (hasBlockComment) {
        keyStart = null;
        key = [key];
        while ((match = this.maybeRegExp(this.assignOrLfOrCommentRegSymbol, true))) {
          symbol = match[0];
          lastIndex = this.pos;
          this.pos = match.index;
          if (keyStart && keyStart !== this.pos) {
            keyEnd = this.pos;
            key.push(this.input.substring(keyStart, keyEnd));
            keyStart = keyEnd;
          }
          if (indexOf.call(this.options.assign, symbol) >= 0) {
            hasAssign = true;
            this.pos = lastIndex;
            break;
          }
          if (!this.eatComment()) {
            break;
          }
          keyStart = this.pos;
        }
        if (!hasAssign) {
          if (!this.options.ignoreMissingAssign) {
            throw makeExpectingError(symbol, this.options.assign, this.pos);
          } else if (match = this.maybeRegExp(/[\r\n]|$/g, true)) {
            this.pos = match.index;
            keyEnd = this.pos;
            if (keyStart !== keyEnd) {
              key.push(this.input.substring(keyStart, keyEnd));
            }
          }
        }
        key = key.join('');
      }
      key = key.trim();
      if (this.options.escapeCharKey) {
        key = key.replace(/\\(.)/g, '$1');
      }
      if (this.options.array) {
        keyLen = key.length;
        if (keyLen > 1 && key[keyLen - 2] === '[' && key[keyLen - 1] === ']') {
          isArray = true;
          key = key.substring(0, keyLen - 2);
        }
      }
      if (key === '') {
        throw makeSynthaxError('Empty key', this.pos, 'KEY');
      }
    }
    if (this.options.ignoreCase) {
      key = key.toLowerCase();
    }
    this.eatSpaceAndComment();
    if (this.pos >= this.len) {
      return [key, this.options.emptyValue, isArray, isStringKey];
    }
    backup = this.pos;
    if ((value = this.maybeString('Value')) || value === '') {
      this.eatSpaceAndComment();
      if (this.pos < this.len) {
        valueStart = this.pos;
        if (this.maybeRegExp(/[\r\n]/g)) {
          this.pos = valueStart;
        } else if (this.options.ignoreInvalidStringValue) {
          this.pos = backup;
          value = null;
        } else {
          throw makeExpectingError(this.input[this.pos], '[EOF]', this.pos);
        }
      }
      if (value && this.options.ignoreCase) {
        value = value.toLowerCase();
      }
    }
    if (!value && value !== '') {
      valueStart = this.pos;
      match = this.maybeRegExp(this.commentOrNewLineRegSymbol, true);
      valueEnd = match.index;
      value = this.input.substring(valueStart, valueEnd);
      this.pos = match.index;
      symbol = match[0];
      if (this.options.blockComment && indexOf.call(this.options.blockComment, symbol) >= 0) {
        valueStart = null;
        value = [value];
        while ((match = this.maybeRegExp(this.commentOrNewLineRegSymbol, true))) {
          this.pos = match.index;
          if (valueStart && valueStart !== this.pos) {
            valueEnd = this.pos;
            value.push(this.input.substring(valueStart, valueEnd));
            valueStart = valueEnd;
          }
          if (!this.eatComment()) {
            break;
          }
          valueStart = this.pos;
        }
        if (match = this.maybeRegExp(/[\r\n]|$/g, true)) {
          this.pos = match.index;
          valueEnd = this.pos;
          if (valueStart !== valueEnd) {
            value.push(this.input.substring(valueStart, valueEnd));
          }
        }
        value = value.join('');
      }
      value = value.trim();
      if (this.options.ignoreCase) {
        value = value.toLowerCase();
      }
      if (this.options.nativeType) {
        switch (value) {
          case 'true':
            value = true;
            break;
          case 'false':
            value = false;
            break;
          default:
            if (isNumeric(value)) {
              value = parseFloat(value);
            } else {
              value = this.coerceValue(value);
            }
        }
      } else {
        value = this.coerceValue(value);
      }
    }
    return [key, value, isArray, isStringKey];
  };

  Parser.prototype.maybeSection = function() {
    var all, section, sectionEnd, sectionStart;
    this.eatAllSpacesAndComment();
    if (this.pos >= this.len) {
      return;
    }
    if (this.maybe('[')) {
      this.eatSpaceAndComment();
      if (section = this.maybeString()) {
        this.eatSpaceAndComment();
      } else {
        all = true;
      }
      sectionStart = this.pos;
      if (this.maybe(']', all)) {
        sectionEnd = this.pos - 1;
        if (!section) {
          section = this.input.substring(sectionStart, sectionEnd).trim();
        }
        if (section === '') {
          throw makeSynthaxError('Empty section', this.pos, 'SECTION');
        }
        return section;
      }
      throw makeExpectingError(this.input[this.pos], ']', this.pos);
    }
  };

  Parser.prototype.inherit = function(config) {
    var child, configs, i, j, parent, ref, section, sections;
    configs = config.sections;
    for (section in configs) {
      configs[section] = deepExtend({}, config.global, configs[section]);
      if (!/\s*:\s*/.test(section)) {
        continue;
      }
      sections = section.split(/\s*:\s*/);
      child = sections[0];
      configs[child] = {};
      for (i = j = 1, ref = sections.length; j < ref; i = j += 1) {
        parent = sections[i];
        if (!has.call(configs, parent)) {
          continue;
        }
        configs[child] = deepExtend({}, configs[parent], configs[child]);
      }
      deepExtend(configs[child], configs[section]);
      delete configs[section];
    }
    return config;
  };

  return Parser;

})();

module.exports = Parser;
