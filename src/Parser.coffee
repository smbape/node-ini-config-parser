has = {}.hasOwnProperty

makeExpectingError = (actual, expected, pos, code = 'EXPECTED')->
    msg = "Excpecting #{expected}. Instead get #{actual}."
    err = makeSynthaxError msg, pos, code
    err

# makeUnExpectingError = (actual, pos, code = 'UNEXPECTED')->
#     msg = "Unexpected token #{actual}."
#     err = makeSynthaxError msg, pos, code
#     err

makeSynthaxError = (msg, pos, code)->
    err = makeError msg, code, pos, SyntaxError
    err

makeError = (msg, code, pos, clazz = Error)->
    if pos
        msg += ' At position ' + pos

    err = new clazz msg
    err.code = code if code
    err

# Based on jQuery 1.11
isNumeric = (obj)->
    !Array.isArray( obj ) and (obj - parseFloat( obj ) + 1) >= 0

# isObject = (value)->
#     type = typeof value
#     type is 'function' or value and type is 'object'

extend = (dst, src)->
    if null is dst or 'object' isnt typeof dst or null is src or 'object' isnt typeof src
        return dst
    for key of src
        dst[key] = src[key]
    dst

defaults = (dst, src)->
    if null is dst or 'object' isnt typeof dst or null is src or 'object' isnt typeof src
        return dst
    for key of src
        if !has.call(dst, key)
            dst[key] = src[key]
    dst

specialReg = new RegExp '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g'

specialCharMap =
    '\\t': '\t'
    '\\r': '\r'
    '\\n': '\n'
    '\\v': '\v'
    '\\f': '\f'
    '\\b': '\b'
    '\\0': '\0'

quoteRegMap =
    "'": /[^\r\n\\](')|[\r\n]/g
    '"': /[^\r\n\\](")|[\r\n]/g
    "'''": /[^\\](''')/g
    '"""': /[^\\](""")/g

OCTAL_REG = /^\\([0-7]{1,3})/g
UNICODE_REG = /^\\u(?:([0-9a-fA-F]{4,5})|\{([0-9a-fA-F]{1,5})\})/g

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
    merge: false # return config as merge of global + sections
    escapeValueChar: true # escap \ in value
    emptyValue: '' # empty value
    ignoreMissingAssign: true
    ignoreInvalidStringKey: false

class Parser
    constructor: (options = {})->
        @options = {}

        for prop of defaultOptions
            @options[prop] = if has.call(options, prop) then options[prop] else defaultOptions[prop]

        for prop in ['onComment', 'defaults']
            if has.call(options, prop) and 'function' is typeof options[prop]
                @[prop] = options[prop]

        if @options.blockComment
            @blockCommentSymbolEscaped = []
            for symbol, i in @options.blockComment
                @blockCommentSymbolEscaped[i] = @escapeReg(symbol)
            @blockCommentRegSymbol = new RegExp @blockCommentSymbolEscaped.join('|'), 'g'

        if @options.lineComment
            @lineCommentSymbolEscaped = []
            for symbol, i in @options.lineComment
                @lineCommentSymbolEscaped[i] = @escapeReg(symbol)
            @lineCommentRegSymbol = new RegExp @lineCommentSymbolEscaped.join('|'), 'g'

        @assignSymbolEscaped = []
        for symbol, i in @options.assign
            @assignSymbolEscaped[i] = @escapeReg(symbol)

        if @lineCommentSymbolEscaped
            @assignOrLfOrLineCommentRegSymbol = new RegExp(@assignSymbolEscaped.join('|') + '|' + @lineCommentSymbolEscaped.join('|') + '|[\\r\\n]', 'g')
            @lineCommentOrNewLineRegSymbol = new RegExp(@lineCommentSymbolEscaped.join('|') + '|[\\r\\n]|$', 'g')
        else
            @assignOrLfOrLineCommentRegSymbol = new RegExp(@assignSymbolEscaped.join('|') + '|[\\r\\n]', 'g')
            @lineCommentOrNewLineRegSymbol = new RegExp('[\\r\\n]|$', 'g')

    parse: (@input)->
        @len = @input.length
        @pos = 0
        config = {global: {}, sections: {}}
        @config(config)
        @mustEnd()

        if @options.inherit
            config = @inherit config

        if @options.dotKey
            config = @dotKey config

        if @options.merge
            config = defaults config.sections, config.global

        config

    config: (config)->
        # global section
        {global, sections} = config
        while not (section = @maybeSection()) and (keyValue = @expectEofOrKeyValue())
            [key, value, isArray] = keyValue
            if isArray
                global[key] or (global[key] = [])
                global[key].push value
            else
                global[key] = value

        # sections
        if section
            sections[section] or (sections[section] = {})
            while newSection = @maybeSection()
                # TODO: multiple section ignore, override, extend, throw
                section = newSection
                sections[section] or (sections[section] = {})

            while keyValue = @expectEofOrKeyValue()
                # TODO: multiple key ignore, override, array, throw
                [key, value, isArray] = keyValue
                if isArray
                    sections[section][key] or (sections[section][key] = [])
                    sections[section][key].push value
                else
                    sections[section][key] = value

                while newSection = @maybeSection()
                    # TODO: multiple section ignore, override, extend, throw
                    section = newSection
                    sections[section] or (sections[section] = {})

        return config

    escapeReg: (str)->
        str.replace specialReg, '\\$1'

    coerceValue: (str)->
        lasIndex = 0
        if @options.escapeValueChar
            if @options.env
                re = /\\(.)|\$(\w+)|(\$\{)|(\})/g
            else
                re = /\\(.)/g
        else if @options.env
            re = /($[^$])|\$(\w+)|(\$\{)|(\})/g
        else
            return str

        res = []
        while match = re.exec(str)
            [__, escaped, variable, _keyStart, _keyEnd] = match

            if escaped
                res.push str.substring(lastIndex, match.index)
                res.push escaped
                lastIndex = re.lastIndex

            else if variable
                # env expansion
                # $\w+
                res.push str.substring(lastIndex, match.index)

                if has.call @options.env, variable
                    variable = @options.env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = __

                res.push variable
                lastIndex = re.lastIndex

            else if _keyEnd and keyStart
                # env expansion
                # ${.+}
                variable = str.substring(keyStart, match.index)

                if has.call @options.env, variable
                    variable = @options.env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = str.substring(lastIndex, re.lastIndex)

                res.push variable
                lastIndex = re.lastIndex
                keyStart = null

            else if _keyStart
                keyStart = re.lastIndex
                res.push str.substring(lastIndex, match.index)
                lastIndex = match.index

        if lastIndex
            if lastIndex < str.length
                res.push str.substring(lastIndex)

            return res.join('')

        return str

    coerceString: (str, symbol)->
        lasIndex = 0
        if @options.env and symbol in ['"""', '"']
            re = /\\(.)|\$(\w+)|(\$\{)|(\})|([\r\n])/g
        else
            re = /\\(.)/g
        res = []

        # https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
        while match = re.exec(str)
            [__, escaped, variable, _keyStart, _keyEnd, lf] = match

            if escaped
                if keyStart
                    # bad substitution
                    keyStart = null

                res.push str.substring(lastIndex, match.index)

                substr = str.substring(match.index, match.index + 7)
                OCTAL_REG.lastIndex = 0
                UNICODE_REG.lastIndex = 0

                if octal = OCTAL_REG.exec(substr)
                    re.lastIndex = match.index + OCTAL_REG.lastIndex
                    octal = parseInt(octal[1], 8)
                    octal = String.fromCharCode(octal)
                    res.push octal

                else if escaped is 'u'
                    if unicode = UNICODE_REG.exec(substr)
                        re.lastIndex = match.index + UNICODE_REG.lastIndex
                        unicode = parseInt(unicode[1] or unicode[2], 16)
                        unicode = String.fromCodePoint(unicode)
                        res.push unicode
                    else
                        # TODO: ignoreInvalidUnicode
                        throw makeSynthaxError 'Invalid Unicode escape sequence', @pos, 'UNICODE'
                else
                    # escape \\
                    # \t\r\n\v\f\b
                    res.push specialCharMap[__] or escaped

                lastIndex = re.lastIndex

            else if variable
                if keyStart
                    # bad substitution
                    keyStart = null

                # env expansion
                # $\w+
                res.push str.substring(lastIndex, match.index)

                if has.call @options.env, variable
                    variable = @options.env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = __

                res.push variable
                lastIndex = re.lastIndex

            else if _keyEnd and keyStart
                # env expansion
                # ${.+}
                variable = str.substring(keyStart, match.index)

                if has.call @options.env, variable
                    variable = @options.env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = str.substring(lastIndex, re.lastIndex)

                res.push variable
                lastIndex = re.lastIndex
                keyStart = null

            else if _keyStart
                keyStart = re.lastIndex
                res.push str.substring(lastIndex, match.index)
                lastIndex = match.index

            else if keyStart and lf
                res.push str.substring(lastIndex, re.lastIndex)
                lastIndex = re.lastIndex
                keyStart = null

        if lastIndex
            if lastIndex < str.length
                res.push str.substring(lastIndex)

            return res.join('')

        return str

    maybe: (symbol, all)->
        if all
            pos = @input.indexOf(symbol, @pos)
            if -1 isnt pos
                @pos = pos + symbol.length
                return symbol
        else
            len = symbol.length
            if len is 1
                if symbol is @input[@pos]
                    @pos++
                    return symbol
            else if symbol is @input.substring(@pos, @pos + len)
                @pos += len
                return symbol

    maybeRegExp: (symbol, all)->
        lasIndex = symbol.lastIndex
        if all
            symbol.lastIndex = @pos
            match = symbol.exec @input
            if match
                @pos = symbol.lastIndex
                symbol.lastIndex = lasIndex
            return match

        if symbol.test @input[@pos]
            symbol.lastIndex = lasIndex
            return @input[@pos++]

    mustEnd: ->
        if @pos isnt @input.length
            throw makeUnExpectingError @input[@pos], @pos
        true

    eatSpace: ->
        pos = @pos
        if match = @maybeRegExp(/[\S\r\n]/g, true)
            @pos = match.index
        else
            # end of file
            @pos = @len

        return pos isnt @pos

    eatAllSpaces: ->
        pos = @pos
        if match = @maybeRegExp(/[\S]/g, true)
            @pos = match.index
        else
            # end of file
            @pos = @len

        return pos isnt @pos

    eatComment: ->
        if @options.blockComment
            for symbol in @options.blockComment
                if @maybe(symbol)
                    commentStart = @pos
                    if not @maybe(symbol, true)
                        # TODO: eofBeforeBlockCommentEnd ignore, end
                        throw makeExpectingError '[EOF]', symbol, @pos
                    if @onComment
                        @onComment @input.substring(commentStart, @pos - symbol.length), 'block-comment'
                    return true

        if @options.lineComment
            for symbol in @options.lineComment
                if @maybe(symbol)
                    commentStart = @pos
                    match = @maybeRegExp /\r?\n|\r|$/g, true
                    if @onComment
                        @onComment @input.substring(commentStart, match.index), 'line-comment'
                    return true

        return

    maybeString: ->
        if @options.mstring
            for symbol in ['"""', "'''"]
                if @maybe(symbol)
                    if @maybe(symbol)
                        return ''

                    strStart = @pos
                    match = @maybeRegExp(quoteRegMap[symbol], true)
                    if match && match[1] is symbol
                        strEnd = match.index + 1
                        str = @input.substring(strStart, strEnd)
                        return @coerceString str, symbol

                    # TODO: ignoreInvalidString
                    throw makeExpectingError match, symbol, @pos

        if @options.string
            if symbol = @maybeRegExp(/['"]/g)
                if @maybe(symbol)
                    return ''

                strStart = @pos
                match = @maybeRegExp(quoteRegMap[symbol], true)
                if match && match[1] is symbol
                    strEnd = match.index + 1
                    str = @input.substring(strStart, strEnd)
                    return @coerceString str, symbol

                # TODO: ignoreInvalidString
                throw makeExpectingError match, symbol, @pos

        return

    eatSpaceAndComment: ->
        while @eatSpace() or @eatComment()
            continue
        return

    eatAllSpacesAndComment: ->
        while @eatAllSpaces() or @eatComment()
            continue
        return

    expectEofOrKeyValue: ->
        @eatAllSpacesAndComment()
        if @pos >= @len
            return

        keyStart = @pos

        if key = @maybeString()
            @eatSpaceAndComment()

            if not (symbol = @maybeRegExp(@assignOrLfOrLineCommentRegSymbol))
                key = null
                @pos = keyStart
                if not @options.ignoreInvalidStringKey
                    throw makeSynthaxError 'Invalid string', @pos, 'INVALID_STRING'

        if symbol or (match = @maybeRegExp(@assignOrLfOrLineCommentRegSymbol, true))
            if match
                symbol = match[0]

            if @options.lineComment and symbol in @options.lineComment
                if not @options.ignoreMissingAssign
                    throw makeExpectingError symbol, @options.assign, @pos

            else if /[\r\n]/.test(symbol) and not @options.ignoreMissingAssign
                throw makeExpectingError symbol, @options.assign, @pos

            if not key
                keyEnd = @pos - symbol.length
                key = @input.substring(keyStart, keyEnd).trim()

                if @options.array
                    keyLen = key.length
                    if keyLen > 1 and key[keyLen - 2] is '[' and key[keyLen - 1] is ']'
                        isArray = true
                        key = key.substring(0, keyLen - 2)

            if key is ''
                # TODO: ignoreEmptyKey
                throw makeSynthaxError 'Empty key', @pos, 'KEY'

        else
            throw makeExpectingError symbol, @options.assign, @pos

        @eatSpaceAndComment()
        if @pos >= @len
            return [key, @options.emptyValue, isArray]

        if value = @maybeString()
            @eatSpaceAndComment()
            if @pos < @len
                if @maybeRegExp(/[\r\n]/g)
                    --@pos
                else
                    # TODO: ignoreInvalidStringValue
                    throw makeExpectingError @input[@pos], '[EOF]', @pos
        else
            valueStart = @pos
            match = @maybeRegExp @lineCommentOrNewLineRegSymbol, true
            valueEnd = match.index
            value = @input.substring(valueStart, valueEnd).trim()
            @pos = match.index

            # TODO: JSON parse {...}

            if @options.nativeType
                switch value
                    when 'true'
                        value = true
                    when 'false'
                        value = false
                    else
                        if isNumeric value
                            value = parseFloat(value)
                        else
                            value = @coerceValue value
            else
                value = @coerceValue value

        return [key, value, isArray]

    maybeSection: ->
        @eatAllSpacesAndComment()
        if @pos >= @len
            return

        if @maybe('[')
            @eatSpaceAndComment()

            if section = @maybeString()
                @eatSpaceAndComment()
            else
                all = true

            sectionStart = @pos
            if @maybe(']', all)
                sectionEnd = @pos - 1
                if not section
                    section = @input.substring(sectionStart, sectionEnd).trim()

                if section is ''
                    # TODO: ignoreEmptySection
                    throw makeSynthaxError 'Empty section', @pos, 'SECTION'

                return section

            # TODO: ignoreNotEndedSection
            throw makeExpectingError @input[@pos], ']', @pos

    parseFlat: (config)->
        parsedConfig = {}
        for key, value of config
            properties = key.split('.')
            _len = properties.length
            if _len < 2
                parsedConfig[key] = value
                continue
            next = parsedConfig

            for i in [0..._len] by 1
                property = properties[i]

                if i is _len - 1
                    next[property] = value
                    break

                if !has.call(next, property)
                    next[property] = {}

                next = next[property]

        parsedConfig

    inherit: (config)->
        configs = config.sections

        for section of configs
            defaults configs[section], config.global

            if !/\s*:\s*/.test(section)
                continue

            sections = section.split(/\s*:\s*/)
            child = sections[0]
            configs[child] = {}

            for i in [1...sections.length] by 1
                parent = sections[i]
                if !has.call(configs, parent)
                    continue

                extend configs[child], configs[parent]

            extend configs[child], configs[section]
            delete configs[section]

        config

    dotKey: (config)->
        configs = config.sections

        config.global = @parseFlat config.global

        for section of configs
            configs[section] = @parseFlat configs[section]

        config

module.exports = Parser
