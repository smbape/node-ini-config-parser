has = {}.hasOwnProperty
unshift = [].unshift
deepExtend = require('deep-extend')

makeExpectingError = (actual, expected, pos, code = 'EXPECTED')->
    msg = "Excpecting #{expected}. Instead get #{actual}."
    err = makeSynthaxError msg, pos, code
    err

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

specialReg = new RegExp '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g'

specialCharMap =
    '\\t': '\t'
    '\\r': '\r'
    '\\n': '\n'
    '\\v': '\v'
    '\\f': '\f'
    '\\b': '\b'

quoteRegMap =
    "'": /[^\r\n\\](')|[\r\n]/g
    '"': /[^\r\n\\](")|[\r\n]/g
    "'''": /[^\\](''')/g
    '"""': /[^\\](""")/g

OCTAL_REG = /^\\([0-7]{1,3})/g
UNICODE_REG = /^\\u(?:([0-9a-fA-F]{4,5})|\{([0-9a-fA-F]{1,5})\})/g

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

class Parser
    constructor: (options = {})->
        if not (@ instanceof  Parser)
            return new Parser(options)

        @options = {}

        for prop of defaultOptions
            @options[prop] = if has.call(options, prop) then options[prop] else defaultOptions[prop]

        for prop in ['onComment', 'onEnvNotFound']
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

        @commentOrNewLineRegSymbol = ['[\\r\\n]', '$']
        @assignOrLfOrCommentRegSymbol = ['[\\r\\n]']

        if @lineCommentSymbolEscaped
            unshift.apply @commentOrNewLineRegSymbol, @lineCommentSymbolEscaped
            unshift.apply @assignOrLfOrCommentRegSymbol, @lineCommentSymbolEscaped

        if @blockCommentSymbolEscaped
            unshift.apply @commentOrNewLineRegSymbol, @blockCommentSymbolEscaped
            unshift.apply @assignOrLfOrCommentRegSymbol, @blockCommentSymbolEscaped

        unshift.apply @assignOrLfOrCommentRegSymbol, @assignSymbolEscaped

        @commentOrNewLineRegSymbol = new RegExp @commentOrNewLineRegSymbol.join('|'), 'mg'
        @assignOrLfOrCommentRegSymbol = new RegExp @assignOrLfOrCommentRegSymbol.join('|'), 'mg'

    parse: (@input)->
        @len = @input.length
        @pos = 0
        config = {global: {}, sections: {}}
        @config(config)
        @mustEnd()

        if @options.inherit
            config = @inherit config

        if @options.merge
            config = deepExtend config.global, config.sections

        config

    config: (config)->
        # global section
        {global, sections} = config
        while not (section = @maybeSection()) and (keyValue = @expectEofOrKeyValue())
            @set global, keyValue

        # sections
        if section
            sections[section] or (sections[section] = {})
            while newSection = @maybeSection()
                # TODO: multiple section ignore, override, extend, throw
                section = newSection
                sections[section] or (sections[section] = {})

            while keyValue = @expectEofOrKeyValue()
                # TODO: multiple key ignore, override, array, throw
                @set sections[section], keyValue

                while newSection = @maybeSection()
                    # TODO: multiple section ignore, override, extend, throw
                    section = newSection
                    sections[section] or (sections[section] = {})

        return config

    set: (obj, [key, value, isArray, isStringKey])->
        if not isStringKey and @options.dotKey
            properties = key.split('.')
            len = properties.length
            if len > 1
                for i in [0...(len - 1)]
                    key = properties[i]
                    if key is ''
                        # TODO: ignoreEmptyKey
                        throw makeSynthaxError 'Empty key', @pos, 'KEY'

                    if not has.call(obj, key)
                        obj[key] = {}

                    obj = obj[key]
                key = properties[len - 1]

        if isArray
            obj[key] or (obj[key] = [])
            obj[key].push value
        else
            obj[key] = value

    escapeReg: (str)->
        str.replace specialReg, '\\$1'

    coerceValue: (str)->
        lastIndex = 0
        if @options.escapeCharValue
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
                res.push str.substring(lastIndex, match.index) if lastIndex isnt match.index
                res.push escaped
                lastIndex = re.lastIndex

            else if variable
                # env expansion
                # $\w+
                res.push str.substring(lastIndex, match.index) if lastIndex isnt match.index

                if has.call @options.env, variable
                    variable = @options.env[variable]
                else if @onEnvNotFound
                    variable = @onEnvNotFound variable, __
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
                else if @onEnvNotFound
                    variable = @onEnvNotFound variable, str.substring(lastIndex, re.lastIndex)
                else
                    variable = str.substring(lastIndex, re.lastIndex)

                res.push variable
                lastIndex = re.lastIndex
                keyStart = null

            else if _keyStart
                keyStart = re.lastIndex
                res.push str.substring(lastIndex, match.index) if lastIndex isnt match.index
                lastIndex = match.index

        if lastIndex
            if lastIndex < str.length
                res.push str.substring(lastIndex)

            if res.length is 1
                return res[0]

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

                res.push str.substring(lastIndex, match.index) if lastIndex isnt match.index

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
                res.push str.substring(lastIndex, match.index) if lastIndex isnt match.index

                if has.call @options.env, variable
                    variable = @options.env[variable]
                else if @onEnvNotFound
                    variable = @onEnvNotFound variable, __
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
                else if @onEnvNotFound
                    variable = @onEnvNotFound variable, str.substring(lastIndex, re.lastIndex)
                else
                    variable = str.substring(lastIndex, re.lastIndex)

                res.push variable
                lastIndex = re.lastIndex
                keyStart = null

            else if _keyStart
                keyStart = re.lastIndex
                res.push str.substring(lastIndex, match.index) if lastIndex isnt match.index
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
                    @pos = match.index
                    if @onComment
                        @onComment @input.substring(commentStart, match.index), 'line-comment'
                    return true

        return

    maybeString: (type)->
        backup = @pos

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

                    if @options['ignoreInvalidString' + type]
                        @pos = backup
                    else
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

                if @options['ignoreInvalidString' + type]
                    @pos = backup
                else
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

        if (key = @maybeString('Key')) or key is ''
            isStringKey = true
            @eatSpaceAndComment()

            if not (symbol = @maybeRegExp(@assignOrLfOrCommentRegSymbol))
                if @options.ignoreInvalidStringKey
                    key = null
                    @pos = keyStart
                else
                    throw makeSynthaxError 'Invalid string', @pos, 'INVALID_STRING'

        if not symbol
            match = @maybeRegExp(@assignOrLfOrCommentRegSymbol, true)
            if match
                symbol = match[0]
                keyEnd = match.index
            else if @options.ignoreMissingAssign
                symbol = ''
                keyEnd = @pos = @len
            else
                throw makeExpectingError symbol, @options.assign, @pos

        hasBlockComment = false

        if (@options.lineComment and symbol in @options.lineComment)
            if @options.ignoreMissingAssign
                @pos = match.index
            else
                throw makeExpectingError symbol, @options.assign, @pos

        else if (@options.blockComment and symbol in @options.blockComment)
            hasBlockComment = true
            @pos = match.index

        else if /[\r\n]/.test(symbol)
            if @options.ignoreMissingAssign
                @pos = match.index
            else
                throw makeExpectingError symbol, @options.assign, @pos

        if not key and key isnt ''
            key = @input.substring(keyStart, keyEnd)
            if hasBlockComment
                keyStart = null
                key = [key]

                while (match = @maybeRegExp @assignOrLfOrCommentRegSymbol, true)
                    symbol = match[0]
                    lastIndex = @pos
                    @pos = match.index

                    if keyStart and keyStart isnt @pos
                        keyEnd = @pos
                        key.push @input.substring(keyStart, keyEnd)
                        keyStart = keyEnd

                    if symbol in @options.assign
                        hasAssign = true
                        @pos = lastIndex
                        break

                    if not @eatComment()
                        break

                    keyStart = @pos

                if not hasAssign
                    if not @options.ignoreMissingAssign
                        throw makeExpectingError symbol, @options.assign, @pos

                    else if match = @maybeRegExp /[\r\n]|$/g, true
                        @pos = match.index
                        keyEnd = @pos
                        if keyStart isnt keyEnd
                            key.push @input.substring(keyStart, keyEnd)

                key = key.join('')

            key = key.trim()

            if @options.escapeCharKey
                key = key.replace /\\(.)/g, '$1'

            if @options.array
                keyLen = key.length
                if keyLen > 1 and key[keyLen - 2] is '[' and key[keyLen - 1] is ']'
                    isArray = true
                    key = key.substring(0, keyLen - 2)

            if key is ''
                # TODO: ignoreEmptyKey
                throw makeSynthaxError 'Empty key', @pos, 'KEY'

        if @options.ignoreCase
            key = key.toLowerCase()

        @eatSpaceAndComment()
        if @pos >= @len
            return [key, @options.emptyValue, isArray, isStringKey]

        backup = @pos

        if (value = @maybeString('Value')) or value is ''
            @eatSpaceAndComment()
            if @pos < @len
                valueStart = @pos
                if @maybeRegExp(/[\r\n]/g)
                    @pos = valueStart
                else if @options.ignoreInvalidStringValue
                    @pos = backup
                    value = null
                else
                    throw makeExpectingError @input[@pos], '[EOF]', @pos

            if value and @options.ignoreCase
                value = value.toLowerCase()

        if not value and value isnt ''
            valueStart = @pos
            match = @maybeRegExp @commentOrNewLineRegSymbol, true
            valueEnd = match.index
            value = @input.substring(valueStart, valueEnd)
            @pos = match.index
            symbol = match[0]

            if @options.blockComment and symbol in @options.blockComment
                valueStart = null
                value = [value]

                while (match = @maybeRegExp @commentOrNewLineRegSymbol, true)
                    @pos = match.index

                    if valueStart and valueStart isnt @pos
                        valueEnd = @pos
                        value.push @input.substring(valueStart, valueEnd)
                        valueStart = valueEnd

                    if not @eatComment()
                        break

                    valueStart = @pos

                if match = @maybeRegExp /[\r\n]|$/g, true
                    @pos = match.index
                    valueEnd = @pos
                    if valueStart isnt valueEnd
                        value.push @input.substring(valueStart, valueEnd)

                value = value.join('')

            value = value.trim()

            if @options.ignoreCase
                value = value.toLowerCase()

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

        return [key, value, isArray, isStringKey]

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

                # TODO: check nothing after section

                return section

            # TODO: ignoreNotEndedSection
            throw makeExpectingError @input[@pos], ']', @pos

    inherit: (config)->
        configs = config.sections

        for section of configs
            configs[section] = deepExtend {}, config.global, configs[section]

            if !/\s*:\s*/.test(section)
                continue

            sections = section.split(/\s*:\s*/)
            child = sections[0]
            configs[child] = {}

            for i in [1...sections.length] by 1
                parent = sections[i]
                if !has.call(configs, parent)
                    continue

                configs[child] = deepExtend {}, configs[parent], configs[child]

            deepExtend configs[child], configs[section]
            delete configs[section]

        config

module.exports = Parser
