
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

has = {}.hasOwnProperty
specialReg = new RegExp '([' + '\\/^$.|?*+()[]{}'.split('').join('\\') + '])', 'g'

class Parser
    constructor: (proto = {})->
        for method, fn of proto
            if !has.call(Parser.prototype, method) and 'function' is typeof fn
                this[method] = fn

        @blockCommentSymbol = proto.blockComment or [';;;', '###']
        @lineCommentSymbol = proto.lineComment or [';', '#']
        @equalSymbol = proto.equal or [':', '=']

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
        @lineCommentOrNewLineRegSymbol = new RegExp(@lineCommentSymbolEscaped.join('|') + '|\\r?\\n|\\r|$', 'g')

    escapeReg: (str)->
        str.replace specialReg, '\\$1'

    parse: (@input)->
        @len = @input.length
        @pos = 0
        config = {global: {}, sections: {}}
        @config(config)
        @mustEnd()
        config

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
                re = new RegExp("[^\\\\](" + symbol + ")", 'g')
                match = @maybeRegExp(re, true)
                if match && match[1] is symbol
                    strEnd = match.index + 1
                    str = @input.substring(strStart, strEnd)
                    return str
                
                throw makeExpectingError match, symbol, @pos

        if symbol = @maybeRegExp(/['"]/g)
            if @maybe(symbol)
                return ''

            strStart = @pos
            re = new RegExp("[^\\r\\n\\\\](" + symbol + ")|\\r?\\n|\\r", 'g')
            match = @maybeRegExp(re, true)
            if match && match[1] is symbol
                strEnd = match.index + 1
                str = @input.substring(strStart, strEnd)
                return str
            
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

    config: (config)->
        while keyValue = @maybeKeyValue()
            [key, value] = keyValue
            config.global[key] = value
        return config

    maybeKeyValue: ->
        @eatAllSpacesAndComment()
        if @pos >= @len
            return

        if @pos >= 410
            debugger

        keyStart = @pos

        if key = @maybeString()
            @eatAllSpacesAndComment()
        else
            all = true

        if symbol = @maybeRegExp(@equalOrLineCommentRegSymbol, all)
            # inline comment
            if symbol in @lineCommentSymbol
                throw makeExpectingError symbol, @equalSymbol, @pos

            if not key
                # TODO: coerce
                keyEnd = @pos - symbol.length
                key = @input.substring(keyStart, keyEnd).trim()
        else
            console.log @equalOrLineCommentRegSymbol.source is ':|=|;|#'
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
                    throw makeExpectingError @input[@pos], '[EOF]', @pos
        else
            valueStart = @pos
            match = @maybeRegExp @lineCommentOrNewLineRegSymbol, true
            valueEnd = match.index
            value = @input.substring(valueStart, valueEnd).trim()

            @pos = match.index

        return [key, value]

module.exports = Parser
