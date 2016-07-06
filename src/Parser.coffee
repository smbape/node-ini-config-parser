
makeExpectingError = (actual, expected, pos, code = 'EXPECTED')->
    msg = "Excpecting #{expected}. Instead get #{actual}."
    err = makeSynthaxError msg, pos, code
    err

makeUnExpectingError = (actual, pos, code = 'UNEXPECTED')->
    msg = "Unexpected token #{actual}."
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
isNumeric = (obj) ->
    !Array.isArray( obj ) and (obj - parseFloat( obj ) + 1) >= 0

has = {}.hasOwnProperty
specialReg = new RegExp '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g'

specialCharMap = {
    '\\t': '\t'
    '\\r': '\r'
    '\\n': '\n'
    '\\v': '\v'
    '\\f': '\f'
    '\\b': '\b'
    '\\0': '\0'
}

quoteRegMap = {
    "'": /[^\r\n\\](')|[\r\n]/g
    '"': /[^\r\n\\](")|[\r\n]/g
    "'''": /[^\\](''')/g
    '"""': /[^\\](""")/g
}

OCTAL_REG = /^\\([0-7]{1,3})/g
UNICODE_REG = /^\\u(?:([0-9a-fA-F]{4,5})|\{([0-9a-fA-F]{1,5})\})/g

class Parser
    constructor: (options = {})->
        @env = if has.call(options, 'env') then options.env else {}
        @nativeType = if has.call(options, 'nativeType') then options.nativeType else true

        for prop in ['onComment', 'defaults']
            if has.call(options, prop) and 'function' is typeof options[prop]
                @[prop] = options[prop]

        @blockCommentSymbol = options.blockComment or [';;;', '###']
        @lineCommentSymbol = options.lineComment or [';', '#']
        @equalSymbol = options.equal or [':', '=']

        @blockCommentSymbolEscaped = []
        for symbol, i in @blockCommentSymbol
            @blockCommentSymbolEscaped[i] = @escapeReg(symbol)
        @blockCommentRegSymbol = new RegExp @blockCommentSymbolEscaped.join('|'), 'g'

        @lineCommentSymbolEscaped = []
        for symbol, i in @lineCommentSymbol
            @lineCommentSymbolEscaped[i] = @escapeReg(symbol)
        @lineCommentRegSymbol = new RegExp @lineCommentSymbolEscaped.join('|'), 'g'

        @equalSymbolEscaped = []
        for symbol, i in @equalSymbol
            @equalSymbolEscaped[i] = @escapeReg(symbol)

        @equalOrLineCommentRegSymbol = new RegExp(@equalSymbolEscaped.join('|') + '|' + @lineCommentSymbolEscaped.join('|'), 'g')
        @lineCommentOrNewLineRegSymbol = new RegExp(@lineCommentSymbolEscaped.join('|') + '|[\\r\\n]|$', 'g')

    parse: (@input)->
        @len = @input.length
        @pos = 0
        config = {global: {}, sections: {}}
        @config(config)
        @mustEnd()
        config

    config: (config)->
        # global section
        {global, sections} = config
        while not (section = @maybeSection()) and (keyValue = @maybeKeyValue())
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

            while keyValue = @maybeKeyValue()
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
        re = /\\(.)|\$(\w+)|(\$\{)|(\})/g
        res = []
        while match = re.exec(str)
            [__, escaped, variable, _keyStart, _keyEnd] = match
            if escaped
                res.push escaped
                lastIndex = re.lastIndex

            else if variable
                # env expansion
                # $\w+
                res.push str.substring(lastIndex, match.index)

                if has.call @env, variable
                    variable = @env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = '$' + variable

                res.push variable
                lastIndex = re.lastIndex

            else if _keyEnd and keyStart
                # env expansion
                # ${.+}
                variable = str.substring(keyStart, match.index)

                if has.call @env, variable
                    variable = @env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = '$' + variable

                res.push variable
                lastIndex = re.lastIndex
                keyStart = null

            else if _keyStart
                if not keyStart
                    keyStart = re.lastIndex
                    res.push str.substring(lastIndex, match.index)
                    lastIndex = match.index

            else if keyStart and lf
                keyStart = null

        if lastIndex
            if lastIndex < str.length
                res.push str.substring(lastIndex)

            return res.join('')

        return str

    coerceString: (str, symbol)->
        lasIndex = 0
        if symbol in ['"""', '"']
            re = /\\(.)|\$(\w+)|(\$\{)|(\})|([\r\n])/g
        else
            re = /\\(.)/g
        res = []

        # https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
        while match = re.exec(str)
            [__, escaped, variable, _keyStart, _keyEnd, lf] = match

            if escaped
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
                        # TODO: warn only
                        throw makeSynthaxError 'Invalid Unicode escape sequence', @pos, 'UNICODE'
                else
                    # escape \\
                    # \t\r\n\v\f\b
                    res.push specialCharMap[__] or escaped

                lastIndex = re.lastIndex

            else if variable
                # env expansion
                # $\w+
                res.push str.substring(lastIndex, match.index)

                if has.call @env, variable
                    variable = @env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = '$' + variable

                res.push variable
                lastIndex = re.lastIndex

            else if _keyEnd and keyStart
                # env expansion
                # ${.+}
                variable = str.substring(keyStart, match.index)

                if has.call @env, variable
                    variable = @env[variable]
                else if @defaults
                    variable = @defaults variable
                else
                    variable = '$' + variable

                res.push variable
                lastIndex = re.lastIndex
                keyStart = null

            else if _keyStart
                if not keyStart
                    keyStart = re.lastIndex
                    res.push str.substring(lastIndex, match.index)
                    lastIndex = match.index

            else if keyStart and lf
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
        for symbol in @blockCommentSymbol
            if @maybe(symbol)
                commentStart = @pos
                if not @maybe(symbol, true)
                    # TODO: warn only
                    throw makeExpectingError '[EOF]', symbol, @pos
                if @onComment
                    @onComment @input.substring(commentStart, @pos - symbol.length), 'block-comment'
                return true

        for symbol in @lineCommentSymbol
            if @maybe(symbol)
                commentStart = @pos
                match = @maybeRegExp /\r?\n|\r|$/g, true
                @onComment @input.substring(commentStart, match.index), 'line-comment'
                return true
        return

    maybeString: ->
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

                # TODO: warn only
                throw makeExpectingError match, symbol, @pos

        if symbol = @maybeRegExp(/['"]/g)
            if @maybe(symbol)
                return ''

            strStart = @pos
            match = @maybeRegExp(quoteRegMap[symbol], true)
            if match && match[1] is symbol
                strEnd = match.index + 1
                str = @input.substring(strStart, strEnd)
                return @coerceString str, symbol

            # TODO: warn only
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

    maybeKeyValue: ->
        @eatAllSpacesAndComment()
        if @pos >= @len
            return

        keyStart = @pos

        if key = @maybeString()
            @eatSpaceAndComment()
        else
            all = true

        if symbol = @maybeRegExp(@equalOrLineCommentRegSymbol, all)
            # inline comment
            if symbol in @lineCommentSymbol
                # TODO: warn only
                throw makeExpectingError symbol, @equalSymbol, @pos

            if not key
                keyEnd = @pos - symbol.length
                key = @input.substring(keyStart, keyEnd).trim()
                keyLen = key.length
                if keyLen > 1 and key[keyLen - 2] is '[' and key[keyLen - 1] is ']'
                    # TODO: optional
                    isArray = true
                    key = key.substring(0, keyLen - 2)

            if key is ''
                # TODO: warn only
                throw makeSynthaxError 'Empty key', @pos, 'KEY'

        else
            throw makeExpectingError symbol, @equalSymbol, @pos

        @eatAllSpacesAndComment()
        if @pos >= @len
            return [key]

        if value = @maybeString()
            @eatSpaceAndComment()
            if @pos < @len
                if @maybeRegExp(/[\r\n]/g)
                    --@pos
                else
                    # TODO: warn only
                    throw makeExpectingError @input[@pos], '[EOF]', @pos
        else
            valueStart = @pos
            match = @maybeRegExp @lineCommentOrNewLineRegSymbol, true
            valueEnd = match.index
            value = @input.substring(valueStart, valueEnd).trim()
            @pos = match.index

            # TODO: JSON parse {...}

            if @nativeType
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
                    # TODO: warn only
                    throw makeSynthaxError 'Empty section', @pos, 'SECTION'

                return section

            # TODO: warn only
            throw makeExpectingError @input[@pos], ']', @pos

module.exports = Parser
