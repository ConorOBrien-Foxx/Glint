class AssertionError extends Error {
    constructor(message = "Assertion failed") {
        super(message);
        this.name = "AssertionError";
    }
}

const assert = (expr, message = "Assertion failed") => {
    if(!expr) {
        // console.error(message);
        throw new AssertionError(message);
    }
    return true;
};

// TODO: tag functions as "synchronous" or "asynchronous", and call .map when synchronous.
const mapInSeries = async function (base, fn, self=null) {
    self ??= this;
    let idx = 0;
    let result = [];
    let size = base.length ?? base.size;
    // pre-allocate. who knows if this actually works
    if(size) {
        result.length = size;
    }
    for(let el of base) {
        let inner = await fn.call(self, el, idx, base);
        result[idx] = inner;
        idx++;
    }
    return result;
};

// modified from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
const getGlintReplacer = () => {
    const ancestors = [];
    return function (key, value) {
        if(typeof value === "symbol") {
            return value.toString();
        }
        if(typeof value !== "object" || value === null) {
            return value;
        }
        // `this` is the object that value is contained in,
        // i.e., its direct parent.
        while(ancestors.length > 0 && ancestors.at(-1) !== this) {
            ancestors.pop();
        }
        if(ancestors.includes(value)) {
            return "[Circular]";
        }
        ancestors.push(value);
        return value;
    };
};

const Glint = {};
// TODO: remove error message when we have multi-index thingies
Glint.accessIndex = (base, indices) =>
    assert(indices.length === 1, `Cannot index ${indices.length} parameters into ${Glint.display(base)}`)
            && (
    base.at
        ? base.at(...indices)
        : base[indices[0]]
    );

Glint.console = {
    silent: true,
    log(...args) {
        if(this.silent) {
            return;
        }
        console.log(...args);
    },
    warn(...args) {
        if(this.silent) {
            return;
        }
        console.warn(...args);
    },
    error(...args) {
        // if(this.silent) {
            // return;
        // }
        console.error(...args);
    },
};

Glint.DataTypes = {
    INT:        0b00000001,
    FLOAT:      0b00000010,
    BIGINT:     0b00000100,
    STRING:     0b00001000,
    LIST:       0b00010000,
    OBJECT:     0b00100000,
    FUNCTION:   0b01000000,
    NULL:       0b10000000,
};
Glint.DataTypes.INT_LIKE = Glint.DataTypes.INT | Glint.DataTypes.BIGINT;
Glint.DataTypes.NUMBER_LIKE = Glint.DataTypes.INT | Glint.DataTypes.FLOAT | Glint.DataTypes.BIGINT;

Glint.typeOf = arg => {
    if(arg === null) {
        return Glint.DataTypes.NULL;
    }
    if(typeof arg === "bigint") {
        return Glint.DataTypes.BIGINT;
    }
    if(typeof arg === "number") {
        return Number.isInteger(arg)
            ? Glint.DataTypes.INT
            : Glint.DataTypes.FLOAT;
    }
    if(typeof arg === "string") {
        return Glint.DataTypes.STRING;
    }
    if(Array.isArray(arg)) {
        return Glint.DataTypes.LIST;
    }
    if(typeof arg === "function" || arg instanceof GlintFunction) {
        return Glint.DataTypes.FUNCTION;
    }
    // TODO: more cases
    return Glint.DataTypes.OBJECT;
}

Glint.typesOfAll = (...args) =>
    args.map(Glint.typeOf);

Glint.TypesToDataMap = Object.fromEntries(
    Object.entries(Glint.DataTypes)
        .map(row => row.reverse())
);
Glint.TypesToNames = {
    [Glint.DataTypes.BIGINT]: "big",
    [Glint.DataTypes.INT]: "int",
    [Glint.DataTypes.FLOAT]: "float",
    [Glint.DataTypes.STRING]: "str",
    [Glint.DataTypes.LIST]: "list",
    [Glint.DataTypes.OBJECT]: "obj",
    [Glint.DataTypes.FUNCTION]: "fn",
    [Glint.DataTypes.NULL]: "null",
};
Glint.getStringType = type => {
    let display = [];
    for(let i = 1; Glint.TypesToDataMap[i]; i <<= 1) {
        if((i & type) !== 0) {
            display.push(Glint.TypesToNames[i]);
        }
    }
    return display.join("|");
};
Glint.getDebugTypes = (...args) =>
    args.map(Glint.typeOf)
        .map(Glint.getStringType)
        .join("; ");

Glint.typeMatches = (datum, typeMask) =>
    (Glint.typeOf(datum) & typeMask) !== 0;

Glint.isInt = arg => Glint.typeMatches(arg, Glint.DataTypes.INT);
Glint.isBigInt = arg => Glint.typeMatches(arg, Glint.DataTypes.BIGINT);
Glint.isFloat = arg => Glint.typeMatches(arg, Glint.DataTypes.FLOAT);
Glint.isString = arg => Glint.typeMatches(arg, Glint.DataTypes.STRING);
Glint.isList = arg => Glint.typeMatches(arg, Glint.DataTypes.LIST);
Glint.isObject = arg => Glint.typeMatches(arg, Glint.DataTypes.OBJECT);
Glint.isFunction = arg => Glint.typeMatches(arg, Glint.DataTypes.FUNCTION);
// psuedo types
Glint.isIntLike = arg => Glint.typeMatches(arg, Glint.DataTypes.INT_LIKE);
Glint.isNumberLike = arg => Glint.typeMatches(arg, Glint.DataTypes.NUMBER_LIKE);

Glint.customDisplay = Symbol("Glint.customDisplay");
Glint._display = (value, ancestors = []) => {
    if(value instanceof Error) {
        return "Internal Error: " + value;
    }
    if(typeof value === "symbol") {
        return value.toString();
    }
    if(ancestors.includes(value)) {
        Glint.console.log(ancestors, value);
        return "[Circular]";
    }
    if(Array.isArray(value)) {
        if(value.length === 0) {
            return "[ ]";
        }
        let nextAncestors = [...ancestors, value];
        return "[ "
            + value
                .map(el => Glint._display(el, nextAncestors))
                .join("; ")
            + " ]";
    }
    if(value === null) {
        return "null";
    }
    if(value === undefined) {
        return "undef";
    }
    if(value[Glint.customDisplay]) {
        let nextAncestors = [...ancestors, value];
        return value[Glint.customDisplay](ancestors);
    }
    if(Number.isNaN(value)) {
        return "nan";
    }
    if(value === Infinity) {
        return "inf";
    }
    if(value === -Infinity) {
        return "-inf";
    }
    if(typeof value === "function") {
        // TODO: better information
        return `<bare fn @ ${value.length || "?"}>`;
    }
    if(typeof value === "bigint") {
        return `${value}n`;
    }
    if(typeof value === "number") {
        let stringRep = value.toFixed(6);
        let [ iPart, fPart ] = stringRep.split(".");
        fPart = fPart.replace(/0+$/, "");
        fPart = fPart ? "." + fPart : "";
        return iPart + fPart;
    }
    if(typeof value === "object") {
        console.log(value);
        let entries = Object.entries(value);
        if(entries.length === 0) {
            return ">[ ]";
        }
        let nextAncestors = [...ancestors, value];
        return ">[ "
            + Object.entries(value)
                .map(([key, el]) => Glint._display(key, nextAncestors) + ": " + Glint._display(el, nextAncestors))
                .join("; ")
            + " ]";
    }
    // todo: better
    return "" + value;
};
// mask hidden parameter
Glint.display = arg => Glint._display(arg);

class GlintFunction {
    constructor(fn) {
        this.fn = fn;
        this.name = "anonymous";
        this.arity = null;
        this.signature = null; // todo
    }
    
    setName(name) {
        this.name = name;
        return this;
    }
    
    setArity(arity) {
        this.arity = arity;
        return this;
    }
    
    call(thisRef, ...args) {
        return this.fn.call(thisRef, ...args);
    }
    
    apply(thisRef, args = []) {
        return this.fn.apply(thisRef, args);
    }
    
    toString() {
        if(this.arity === null) {
            return `{{ Function ${this.name} }}`;
        }
        else {
            return `{{ Function ${this.name}/${Glint.display(this.arity)} }}`;
        }
    }
    
    [Glint.customDisplay](ancestors) {
        return this.toString();
    }
}

Glint.deepCompare = (a, b) => {
    if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        
        if(keysA.length !== keysB.length) {
            return keysA.length < keysB.length ? -1 : 1;
        }
        
        for(let key of keysA) {
            if(!b.hasOwnProperty(key)) {
                return -1;
            }
            const comparisonResult = Glint.deepCompare(a[key], b[key]);
            if(comparisonResult !== 0) {
                return comparisonResult;
            }
        }
        return 0;
    }
    else {
        return (a > b) - (a < b);
    }
};
Glint.range = (min, max, step) => {
    if(step === undefined) {
        step = 1;
    }
    if(max === undefined) {
        max = min;
        min = 0;
    }
    if(typeof max === "bigint" || typeof min === "bigint") {
        max = BigInt(max);
        min = BigInt(min);
        step = BigInt(step);
    }
    let count = Math.ceil(Number(max - min) / Number(step));
    let array = [...Array(count).keys()];
    if(typeof max === "bigint") {
        array = array.map(BigInt);
    }
    return array.map(i => i * step + min);
};
Glint.sort = sortable => 
    [...sortable].sort(Glint.deepCompare);

class GlintTokenizer {
    constructor(string) {
        this.string = string;
        this.idx = 0;
        this.tokens = [];
    }
    
    extractRegexAt(regex) {
        let matchData = this.string.slice(this.idx).match(regex);
        if(!matchData || matchData.index !== 0 || !matchData[0].length) {
            return null;
        }
        let [ whole, ...groups ] = matchData;
        this.idx += whole.length;
        return { whole, groups };
    }
    
    static Types = {
        OPERATOR: Symbol("GlintTokenizer.Types.OPERATOR"),
        ADVERB: Symbol("GlintTokenizer.Types.ADVERB"),
        NUMBER: Symbol("GlintTokenizer.Types.NUMBER"),
        WORD: Symbol("GlintTokenizer.Types.WORD"),
        WHITESPACE: Symbol("GlintTokenizer.Types.WHITESPACE"),
        OPEN_PAREN: Symbol("GlintTokenizer.Types.OPEN_PAREN"),
        CLOSE_PAREN: Symbol("GlintTokenizer.Types.CLOSE_PAREN"),
        OPEN_BRACKET: Symbol("GlintTokenizer.Types.OPEN_BRACKET"),
        CLOSE_BRACKET: Symbol("GlintTokenizer.Types.CLOSE_BRACKET"),
        OPEN_BRACE: Symbol("GlintTokenizer.Types.OPEN_BRACE"),
        CLOSE_BRACE: Symbol("GlintTokenizer.Types.CLOSE_BRACE"),
        SEPARATOR: Symbol("GlintTokenizer.Types.SEPARATOR"),
        OP_CAPTURE: Symbol("GlintTokenizer.Types.OP_CAPTURE"),
        STRING: Symbol("GlintTokenizer.Types.STRING"),
    };
    // TODO: accept custom operators
    // final operator names have all whitespace removed
    static Regexes = [
        // TODO: better comma-in-number verification (e.g. ,,,3., is a valid number)
        [ /(_?(?:[\d,]+(?:\.[\d,]+)?|\.[\d,]+))(deg|n|b|big)?/, GlintTokenizer.Types.NUMBER ],
        [ /%\s*of|<=>|\|>|[:<>!]=|[-+\/%*^=<>!@#|]|:|`\w+`/, GlintTokenizer.Types.OPERATOR ],
        [ /[.&]/, GlintTokenizer.Types.ADVERB ],
        [ /\w+/, GlintTokenizer.Types.WORD ],
        [ /[ \t]+/, GlintTokenizer.Types.WHITESPACE ],
        [ /[\r\n]+/, GlintTokenizer.Types.LINEBREAK ],
        [ /;/, GlintTokenizer.Types.SEPARATOR ],
        [ /\(/, GlintTokenizer.Types.OPEN_PAREN ],
        [ /\)/, GlintTokenizer.Types.CLOSE_PAREN ],
        [ /\[/, GlintTokenizer.Types.OPEN_BRACKET ],
        [ /\]/, GlintTokenizer.Types.CLOSE_BRACKET ],
        [ /\{/, GlintTokenizer.Types.OPEN_BRACE ],
        [ /\}/, GlintTokenizer.Types.CLOSE_BRACE ],
        [ /"(?:[^"]|"")*"/, GlintTokenizer.Types.STRING ],
    ];
    
    parseToken() {
        for(let [ regex, type ] of GlintTokenizer.Regexes) {
            let data = this.extractRegexAt(regex);
            if(data === null) {
                continue;
            }
            this.tokens.push({
                type,
                value: data.whole,
                groups: data.groups,
            });
            if(type === GlintTokenizer.Types.OPERATOR) {
                // remove whitespace
                this.tokens.at(-1).value = this.tokens.at(-1).value.replace(/\s+/g, "");
            }
            return true;
        }
        return false;
    }
    
    getTokens() {
        
        while(this.parseToken()) {
            // pass
        }
        assert(this.idx >= this.string.length, `Could not parse entire string, stopped at index ${this.idx}/${this.string.length}`);
        
        return this.tokens;
    }
}

class GlintShunting {
    // TODO: chaining comparisons? e.g. a < b < c is equiv. to a < b && b < c?
    static Precedence = {
        "(":    { precedence: -10,  associativity: "left" },
        "[":    { precedence: -10,  associativity: "left" },
        // "{":    { precedence: -10,  associativity: "left" },
        ":=":   { precedence: 0,    associativity: "right" },
        ":":    { precedence: 3,    associativity: "left" },
        "=":    { precedence: 5,    associativity: "left" },
        "<=":   { precedence: 5,    associativity: "left" },
        "<":    { precedence: 5,    associativity: "left" },
        ">=":   { precedence: 5,    associativity: "left" },
        ">":    { precedence: 5,    associativity: "left" },
        "!=":   { precedence: 5,    associativity: "left" },
        "<=>":  { precedence: 7,    associativity: "left" },
        "|>":   { precedence: 10,   associativity: "left" },
        "|":    { precedence: 10,   associativity: "left" },
        "`":    { precedence: 13,   associativity: "left" },
        "#":    { precedence: 15,   associativity: "left" },
        "+":    { precedence: 20,   associativity: "left" },
        "-":    { precedence: 20,   associativity: "left" },
        "*":    { precedence: 30,   associativity: "left" },
        "/":    { precedence: 30,   associativity: "left" },
        "%of":  { precedence: 30,   associativity: "left" },
        "%":    { precedence: 30,   associativity: "left" },
        "^":    { precedence: 40,   associativity: "right" },
        "@":    { precedence: 90,   associativity: "left" },
    }
    
    constructor(tokens) {
        this.tokens = tokens;
        this.outputQueue = [];
        this.operatorStack = [];
        // for keep track of which prefix adverbs are being used
        this.adverbStack = [];
        // for tracking number of function parameters
        this.arityStack = [];
        // operators at the start of an expression are unary
        this.nextOpArity = 1;
        // initial parentheses are not function calls
        this.nextParenIsFunctionCall = false;
        // detect consecutive data entries (illegal)
        this.lastWasData = false;
        this.autoInsertParentheses();
    }
    
    // transforms expressions like `3 + f 4 * 5` to `3 + f(4 * 5)`
    autoInsertParentheses() {
        for(let i = 0; i < this.tokens.length; i++) {
            let token = this.tokens[i];
            
            if(token.type === GlintTokenizer.Types.WORD) {
                let j = i + 1;
                // find next significant token
                while(j < this.tokens.length && this.shouldSkip(this.tokens[j])) {
                    j++;
                }
                let nextToken = this.tokens[j];
                
                if(!nextToken || !this.isDataStart(nextToken)) {
                    continue;
                }
                // insert open parenthesis before j
                this.tokens.splice(j, 0, {
                    type: GlintTokenizer.Types.OPEN_PAREN,
                    value: "(",
                    groups: [],
                });
                // find relative end of expression
                let k = j;
                while(k < this.tokens.length && this.tokens[k].type !== GlintTokenizer.Types.CLOSE_PAREN) {
                    k++;
                }
                // insert corresponding close parenthesis
                this.tokens.splice(k, 0, {
                    type: GlintTokenizer.Types.CLOSE_PAREN,
                    value: ")",
                    groups: [],
                });
            }
        }
        Glint.console.log("Parenthesized:", this.tokens.filter(e=>e.type!==GlintTokenizer.Types.WHITESPACE).map(e => e.value).join` `);
    }
    
    isData(token) {
        return token.type === GlintTokenizer.Types.NUMBER
            || token.type === GlintTokenizer.Types.WORD
            || token.type === GlintTokenizer.Types.STRING;
    }
    
    isDataStart(token) {
        return this.isData(token)
            || token.type === GlintTokenizer.Types.OPEN_BRACKET;
    }
    
    getPrecedenceInfo(value) {
        return GlintShunting.Precedence[value[0] === "`" ? "`" : value];
    }
    
    comparePrecedence(token, stackToken) {
        let tokenInfo = this.getPrecedenceInfo(token.value);
        let stackTokenInfo = this.getPrecedenceInfo(stackToken.value);
        
        assert(tokenInfo, `Expected ${token.value} (from Token ${Glint.display(token)}) to have defined Precedence`);
        assert(stackTokenInfo, `Expected ${stackToken.value} Token (from ${Glint.display(stackToken)}) to have defined Precedence`);
        
        if(token.arity === 1) {
            // regardless of stackToken.arity, 1 or 2
            return false;
        }
        else if(token.arity === 2 && stackToken.arity === 1) {
            return true;
        }
        else if(stackTokenInfo.associativity === "left") {
            return tokenInfo.precedence <= stackTokenInfo.precedence;
        }
        else {
            return tokenInfo.precedence < stackTokenInfo.precedence;
        }
    }
    
    shouldSkip(token) {
        return token.type === GlintTokenizer.Types.WHITESPACE;
    }
    
    flushTo(...types) {
        while(
            this.operatorStack.length > 0
            && !types.includes(this.operatorStack.at(-1).type)
        ) {
            this.outputQueue.push(this.operatorStack.pop());
        }
        assert(types.length === 0 || this.operatorStack.length > 0,
            `Error: Could not find matching flush target ${Glint.display(types)}`
        );
    }
    
    flagDataForTopArity() {
        if(this.arityStack.length > 0 && this.arityStack.at(-1) === 0) {
            this.arityStack[this.arityStack.length - 1] = 1;
        }
    }
    
    assertNoAdverbs(token) {
        // TODO: better error reporting e.g. where
        assert(this.adverbStack.length === 0, `Unexpected adverb`);
    }
    
    parseToken(token) {
        Glint.console.log("!!!! parsing", token.type, token.value);
        Glint.console.log("Op stack:", this.operatorStack.map(e => e.value));
        Glint.console.log("Arity stack:", this.arityStack);
        
        let nextLastWasData = false;
        let skipped = false;
        
        if(this.isData(token)) {
            assert(!this.lastWasData, "Illegal to have two consecutive pieces of data");
            this.assertNoAdverbs(token);
            this.outputQueue.push(token);
            // operators following data are binary
            // e.g. 3 + 5
            this.nextOpArity = 2;
            // we have data: make sure the arity is at least 1
            this.flagDataForTopArity();
            this.nextParenIsFunctionCall = true;
            nextLastWasData = true;
        }
        else if(token.type === GlintTokenizer.Types.ADVERB) {
            this.adverbStack.push(token);
        }
        else if(token.type === GlintTokenizer.Types.LINEBREAK) {
            console.log("separator encountered");
            // TODO: check to see we are only breaking when syntactically valid
            this.flushTo();
            nextLastWasData = false;
            this.nextParenIsFunctionCall = false;
        }
        else if(token.type === GlintTokenizer.Types.SEPARATOR) {
            // separates function arguments
            this.flushTo(
                GlintTokenizer.Types.OPEN_PAREN,
                GlintTokenizer.Types.OPEN_BRACKET,
            );
            this.nextOpArity = 1;
            assert(this.arityStack.length > 0, "Unexpected separator outside function call");
            this.arityStack[this.arityStack.length - 1]++;
            this.nextParenIsFunctionCall = false;
        }
        else if(token.type === GlintTokenizer.Types.OPERATOR) {
            let tokenWithArity = {
                ...token,
                arity: this.nextOpArity,
                adverbs: this.adverbStack.splice(0).reverse(),
            };
            while (
                this.operatorStack.length > 0 && this.comparePrecedence(tokenWithArity, this.operatorStack.at(-1))
            ) {
                this.outputQueue.push(this.operatorStack.pop());
            }
            this.operatorStack.push(tokenWithArity);
            // operators following any operator must be unary
            this.nextOpArity = 1;
            this.nextParenIsFunctionCall = false;
        }
        else if(token.type === GlintTokenizer.Types.OPEN_PAREN) {
            if(this.nextParenIsFunctionCall) {
                // handle function call case
                // XXX: it's probably sinful to pop from the outputQueue but whatever.
                // TODO: allow adverbs to apply to function callers
                let functionHandle = this.outputQueue.pop();
                /*
                console.log("Opcall funciton handle:", functionHandle);
                if(typeof functionHandle.arity === "undefined") {
                    let functionToken = {
                        ...functionHandle,
                        arity: 0,
                    };
                    this.operatorStack.push(functionToken);
                }
                else {
                    //
                }
                */
                this.outputQueue.push(functionHandle);
                this.operatorStack.push({
                    type: GlintTokenizer.Types.OPERATOR,
                    value: "@",
                    arity: 1, // add 1 because we are gonna have another item on stack, in addition to the 1 we already have
                });
                this.arityStack.push(0);
                this.operatorStack.push({
                    ...token,
                    isFunctionCall: true,
                });
            }
            else {
                this.operatorStack.push({
                    ...token,
                    isFunctionCall: false,
                });
            }
            // operators immediately following an open parenthesis are necessarily unary
            // e.g. (+3 * 5)
            this.nextOpArity = 1;
            this.nextParenIsFunctionCall = false;
        }
        else if(token.type === GlintTokenizer.Types.CLOSE_PAREN) {
            this.flushTo(GlintTokenizer.Types.OPEN_PAREN);
            let openParen = this.operatorStack.pop();
            if(openParen.isFunctionCall) {
                // Glint.console.log("handling function call", this.operatorStack.at(-1));
                // handle function
                let functionToken = this.operatorStack.pop();
                functionToken.arity += this.arityStack.pop();
                this.outputQueue.push(functionToken);
            }
            // operators immediately following a close parenthesis must be binary
            // e.g. (3 * 5) - 6
            this.nextOpArity = 2;
            // if we have a parenthetical after a parenthetical, interpret as call
            this.nextParenIsFunctionCall = true;
            this.flagDataForTopArity();
        }
        else if(token.type === GlintTokenizer.Types.OPEN_BRACKET) {
            this.arityStack.push(0);
                this.operatorStack.push(token);
            // operators immediately following an open bracket are necessarily unary
            // e.g. [+3 * 5]
            this.nextOpArity = 1;
            this.nextParenIsFunctionCall = false;
        }
        else if(token.type === GlintTokenizer.Types.CLOSE_BRACKET) {
            let startFlushIndex = this.operatorStack.length;
            this.flushTo(GlintTokenizer.Types.OPEN_BRACKET);
            let opsFlushed = startFlushIndex - this.operatorStack.length;
            
            this.operatorStack.pop();
            
            let arity = this.arityStack.pop();
            if(arity === 0 && opsFlushed > 0) {
                // capture op
                // XXX: more sinful output queue popping
                let ops = this.outputQueue.splice(-opsFlushed);
                ops.reverse();
                this.outputQueue.push({
                    type: GlintTokenizer.Types.OP_CAPTURE,
                    value: "[" + ops.map(e => e.value) + "]",
                    groups: ops,
                });
            }
            else {
                this.outputQueue.push({
                    ...token,
                    arity,
                });
            }
            this.flagDataForTopArity();
            this.nextOpArity = 2;
            // []() is an indexing/call expression
            this.nextParenIsFunctionCall = true;
        }
        else if(this.shouldSkip(token)) {
            // do nothing
            skipped = true;
        }
        else {
            assert(false, `Unhandled token: ${Glint.display(token)}`);
        }
        
        if(!skipped) {
            this.lastWasData = nextLastWasData;
        }
    }
    
    assertFullOperands() {
        let mockQueue = [...this.outputQueue];
        
        let stackSize = 0;
        mockQueue.forEach(token => {
            if(typeof token.arity !== "undefined") {
                // TODO: inspect what arities the operator expects for error reporting, e.g. "expected 1 or 2" for "-"
                assert(stackSize >= token.arity, `Insufficient operands for operator ${token.value}, expected ${token.arity}, got ${stackSize}`);
                stackSize -= token.arity;
                stackSize++;
            }
            else {
                stackSize++;
            }
        });
    }
    
    shuntingYard() {
        for(let token of this.tokens) {
            this.parseToken(token);
        }
        
        // flush
        while(this.operatorStack.length > 0) {
            this.outputQueue.push(this.operatorStack.pop());
        }
        
        this.assertNoAdverbs();
        this.assertFullOperands();

        Glint.console.log("Shunting yard:", this.debugOutputQueue());
        
        return this.outputQueue;
    }
    
    debugOutputQueue() {
        return this.outputQueue
            .map(e => e.arity !== undefined ? e.value + "@" + e.arity : e.value)
            .join(" ");
    }
}

const SYMBOL_MAP = {
    "redact": "█",
    "larr": "←",
    "rarr": "→",
    "uarr": "↑",
    "darr": "↓",
    "cdot": "·",
    "bullet": "●",
    "bull": "●",
    "ndash": "–",
    "mdash": "—",
    "n": "\n",
    "r": "\r",
    "t": "\t",
    "inf": "∞",
    "ib": "‽",
    "interro": "‽",
    "interrobang": "‽",
};
const symbolFromName = name => {
    return SYMBOL_MAP[name];
};

// TODO: universal call syntax (e.g. f.g(h) expands to g(f, h))
class GlintInterpreter {
    constructor() {
        this.variables = {
            true: true,
            false: false,
            null: null,
            undef: undefined,
            nan: NaN,
            inf: Infinity,
            ["∞"]: Infinity,
        };
    }
    
    loadStandardLibrary() {
        Object.assign(this.variables, {
            SYMBOL_MAP,
            sym: symbolFromName,
            pi: Math.PI,
            e: Math.E,
            // functions
            map: new GlintFunction(function (...args) {
                if(args.length === 1) {
                    let fn = args[0];
                    return new GlintFunction(function (arr) {
                        console.log(this);
                        return this.variables.map.call(this, arr, fn);
                    })
                        .setName(`map:${fn.name}`)
                        .setArity(1);
                }
                assert(args.length === 2, "Incorrect given to map (expected 1 or 2)");
                let [ arr, fn ] = args;
                return mapInSeries.call(this, arr, fn);
            })
                .setName("map")
                .setArity([2, 1]),
            deg: new GlintFunction(n => n * Math.PI / 180)
                .setName("deg")
                .setArity(1),
            c: new GlintFunction((...args) => args)
                .setName("c")
                .setArity(Infinity),
            sum: new GlintFunction(x => x.reduce((p, c) => p + c, 0))
                .setName("sum")
                .setArity(1),
            size: new GlintFunction(x => x.length ?? x.size)
                .setName("size")
                .setArity(1),
            range: new GlintFunction(Glint.range)
                .setName("range")
                .setArity([1, 2, 3]),
            sort: new GlintFunction(Glint.sort)
                .setName("sort")
                .setArity(1),
            big: new GlintFunction(n => BigInt(n))
                .setName("big")
                .setArity(1),
            uniq: new GlintFunction(s => [...new Set(s)])
                .setName("uniq")
                .setArity(1),
            eval: new GlintFunction(GlintInterpreter.prototype.eval)
                .setName("eval")
                .setArity(1),
            // TODO: overload for arrays
            split: new GlintFunction((s, by) => s.split(y))
                .setName("split")
                .setArity(2),
            join: new GlintFunction((a, by) => a.join(by))
                .setName("join")
                .setArity(2),
            lines: new GlintFunction(s => s.split("\n"))
                .setName("lines")
                .setArity(1),
            unlines: new GlintFunction(s => s.join("\n"))
                .setName("unlines")
                .setArity(1),
            // TODO: make work for web version
            print: new GlintFunction((...args) => console.log(...args.map(e => e.toString())))
                .setName("print")
                .setArity(1),
        });
        let mathWords = [
            "sin", "cos", "tan", "sinh", "cosh", "tanh",
            "asin", "acos", "atan", "asinh", "acosh", "atanh", "atan2",
        ];
        for(let word of mathWords) {
            this.variables[word] = new GlintFunction(Math[word])
                .setName(word)
                .setArity(Math[word].length);
        }
    }
    
    assertArity(instruction, args, expectedArity) {
        assert(
            args.length === expectedArity,
            `Could not call arity-${expectedArity} operator ${instruction} as arity-${args.length}. Parameters: ${args.map(Glint.display).join("; ")}`
        );
    }
    
    async evalOp(value, args) {
        if(value === ":=") {
            let [ varDefinition, value ] = args;
            console.log(":=", varDefinition, value);
            if(varDefinition.value.type === GlintTokenizer.Types.OPERATOR && varDefinition.value.value === "@") {
                // function definition
                let [ varName, ...varArgs ] = varDefinition.children;
                
                let params = varArgs.map(child => child.value.value);
                let fn = (...args) => {
                    // TODO: better scoping
                    // this.addLocalScope(Object.fromEntries(params.map((param, idx) => [ param, args[idx] ])));
                    
                    // for now, variables get set in GLOBAL SCOPE >:|
                    params.forEach((param, idx) => {
                        this.variables[param] = args[idx];
                    });
                    
                    return this.evalTree(value);
                    // this.removeLocalScope();
                };
                this.variables[varName.value.value] = new GlintFunction(fn)
                    .setName(varName.value.value)
                    .setArity(params.length);
                return this.variables[varName.value.value];
            }
            else {
                // regular variable assignment
                // TODO: there's something fishy here, as `x + y := 13` is not caught
                assert(varName.children === null, "Cannot handle nested assignment expression");
                value = await this.evalTree(value);
                this.variables[varName.value.value] = value;
                return value;
            }
        }
        
        if(value[0] === "`") {
            let functionName = value.slice(1, -1);
            let fn = this.variables[functionName];
            return fn.apply(null, args);
        }
        
        if(value === "%of") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            // return x * y / 100;
            return this.evalOp("/", [
                await this.evalOp("*", [ x, y ]),
                100
            ]);
        }
        
        if(value === "#") {
            let [ x, y ] = args;
            if(args.length === 1) {
                if(typeof x.length !== "undefined") {
                    return x.length;
                }
                assert(false, `Cannot monadic # on type ${Glint.getDebugTypes(x)}`);
            }
            this.assertArity(value, args, 2);
            // TODO: better behavior for list y
            if(Glint.isIntLike(x)) {
                return [...Array(Number(x))].fill(y);
            }
            assert(false, `Cannot dyadic # types ${Glint.getDebugTypes(...args)}`);
        }
        
        if(value === "+") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(args.every(Glint.isIntLike) && args.some(Glint.isBigInt)) {
                return BigInt(x) + BigInt(y);
            }
            else if(args.every(Glint.isNumberLike)) {
                return Number(x) + Number(y);
            }
            else if(args.every(Glint.isString)) {
                return x + y;
            }
            else if(args.every(Glint.isList)) {
                return [...x, ...y];
            }
            else if(args.every(Glint.isObject)) {
                return {...x, ...y};
            }
            else {
                assert(false, `Cannot add types ${Glint.getDebugTypes(...args)}`);
            }
        }
        
        if(value === "-") {
            let [ x, y ] = args;
            if(args.length === 1) {
                return -x;
            }
            if(args.every(Glint.isIntLike) && args.some(Glint.isBigInt)) {
                return BigInt(x) - BigInt(y);
            }
            else if(args.every(Glint.isNumberLike)) {
                return Number(x) - Number(y);
            }
            // else if(args.every(Glint.isString)) {
                // return x + y;
            // }
            // else if(args.every(Glint.isList)) {
                // return [...x, ...y];
            // }
            // else if(args.every(Glint.isObject)) {
                // return {...x, ...y};
            // }
            else {
                assert(false, `Cannot subtract types ${Glint.getDebugTypes(...args)}`);
            }
        }
        
        if(value === "*") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(args.every(Glint.isIntLike) && args.some(Glint.isBigInt)) {
                return BigInt(x) * BigInt(y);
            }
            else if(args.every(Glint.isNumberLike)) {
                return Number(x) * Number(y);
            }
            else if(Glint.isNumberLike(x) && Glint.isString(y)) {
                return y.repeat(x);
            }
            else if(Glint.isString(x) && Glint.isNumberLike(y)) {
                return x.repeat(y);
            }
            else {
                assert(false, `Cannot multiply types ${Glint.getDebugTypes(...args)}`);
            }
        }
        
        if(value === "/") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(Glint.isList(x) && Glint.isFunction(y)) {
                return x.reduce((p, c) => y.call(null, p, c));
            }
            if(args.every(Glint.isIntLike) && args.some(Glint.isBigInt)) {
                return BigInt(x) / BigInt(y);
            }
            else if(args.every(Glint.isNumberLike)) {
                return Number(x) / Number(y);
            }
            // else if(args.every(Glint.isString)) {
                // return x + y;
            // }
            // else if(args.every(Glint.isList)) {
                // return [...x, ...y];
            // }
            // else if(args.every(Glint.isObject)) {
                // return {...x, ...y};
            // }
            else {
                assert(false, `Cannot divide types ${Glint.getDebugTypes(...args)}`);
            }
        }
        
        if(value === "%") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(args.every(Glint.isIntLike) && args.some(Glint.isBigInt)) {
                return BigInt(x) % BigInt(y);
            }
            else if(args.every(Glint.isNumberLike)) {
                return Number(x) % Number(y);
            }
            // else if(args.every(Glint.isString)) {
                // return x + y;
            // }
            // else if(args.every(Glint.isList)) {
                // return [...x, ...y];
            // }
            // else if(args.every(Glint.isObject)) {
                // return {...x, ...y};
            // }
            else {
                assert(false, `Cannot mod types ${Glint.getDebugTypes(...args)}`);
            }
        }
        
        if(value === "^") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(args.every(Glint.isIntLike) && args.some(Glint.isBigInt)) {
                return BigInt(x) ** BigInt(y);
            }
            else if(args.every(Glint.isNumberLike)) {
                return Number(x) ** Number(y);
            }
            // else if(args.every(Glint.isString)) {
                // return x + y;
            // }
            // else if(args.every(Glint.isList)) {
                // return [...x, ...y];
            // }
            // else if(args.every(Glint.isObject)) {
                // return {...x, ...y};
            // }
            else {
                assert(false, `Cannot exponentiate types ${Glint.getDebugTypes(...args)}`);
            }
        }
        
        if(value === "|>" || value === "|") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(Glint.isFunction(y)) {
                return y.call(this, x);
            }
            assert(false, `Cannot pipe types ${Glint.getDebugTypes(...args)}`);
        }
        
        if(value === "<=>") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            return Glint.deepCompare(x, y);
        }
        
        if(value === ">") {
            let [ x, y ] = args;
            if(args.length === 1) {
                return Object.fromEntries(x);
            }
            else {
                return Glint.deepCompare(x, y) > 0;
            }
        }
        
        if(value === "<") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            return Glint.deepCompare(x, y) < 0;
        }
        
        if(value === ">=") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            return Glint.deepCompare(x, y) >= 0;
        }
        
        if(value === "<=") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            return Glint.deepCompare(x, y) <= 0;
        }
        
        if(value === "=") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            return Glint.deepCompare(x, y) == 0;
        }
        
        if(value === "!=") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            return Glint.deepCompare(x, y) != 0;
        }
        
        if(value === "@") {
            let [ base, ...indices ] = args;
            if(Glint.isFunction(base)) {
                return base.apply(this, indices);
            }
            else {
                return Glint.accessIndex(base, indices);
            }
        }
        
        if(value === ":") {
            // let [ x, y ] = args;
            return args;
            /*
            if(args.length === 1) {
                return [ x ];
            }
            else {
                return [ x, y ];
            }
            */
        }
        
        assert(false, `Could not handle instruction ${value}@${args.length}`);
    }
    
    broadcast(fn, args) {
        if(args.length === 0) {
            return fn();
        }
        else if(args.length === 1) {
            let [ xs ] = args;
            // TODO: better check for iterability/indexability than `!!xs.map`
            return xs.map
                ? mapInSeries(xs, x => this.broadcast(fn, [ x ]))
                : fn(xs);
        }
        else if(args.length === 2) {
            let [ xs, ys ] = args;
            return xs.map && ys.map
                ? mapInSeries(xs, (x, idx) => this.broadcast(fn, [ x, ys[idx] ]))
                : xs.map
                    ? mapInSeries(xs, x => this.broadcast(fn, [ x, ys ]))
                    : ys.map
                        ? mapInSeries(ys, y => this.broadcast(fn, [ xs, y ]))
                        : fn(xs, ys);
        }
        else {
            assert(false, `Cannot broadcast with ${args.length} arguments yet`);
        }
    }
    
    async evalTreeOp(instruction, args) {
        let { value, arity, adverbs } = instruction;
        adverbs ??= [];
        
        let hold = args.map(() => false);
        
        // TODO: custom hold
        if(value === ":=") {
            hold[0] = true;
            hold[1] = true;
        }
        
        args = await mapInSeries(args,
            (arg, idx) => hold[idx] ? arg : this.evalTree(arg)
        );
        
        if(adverbs.length === 0) {
            return this.evalOp(instruction.value, args);
        }
        else {
            // TODO: more generic system
            assert(adverbs.length === 1 && adverbs[0].value === ".", "Cannot handle other adverbs than `.` yet");
            return this.broadcast((...inner) => this.evalOp(instruction.value, inner), args);
        }
    }
    
    makeTree(string) {
        let tokenizer = new GlintTokenizer(string);
        let tokens = tokenizer.getTokens();
        let shunter = new GlintShunting(tokens);
        let rpn = shunter.shuntingYard();
        let treeStack = [];
        for(let instruction of rpn) {
            Glint.console.log("Making tree instruction", Glint.display(instruction));
            if(instruction.arity === undefined) {
                treeStack.push({ value: instruction, children: null });
            }
            else {
                treeStack.push({
                    value: instruction,
                    children: instruction.arity === 0 ? [] : treeStack.splice(-instruction.arity),
                });
            }
        }
        /*
        assert(treeStack.length === expectedExpressionCount,
            `Expected exactly ${expectedExpressionCount} expressions on the treeStack at the end, got ${treeStack.length}`);
            */
        return treeStack;
    }
    
    parseNumber(token) {
        Glint.console.log(token);
        // let string = token.value;
        let [ number, suffix ] = token.groups;
        number = number.replace(/,/g, "").replace(/_/, "-");
        if(suffix === "deg") {
            number = parseFloat(number) * Math.PI / 180;
        }
        else if(suffix === "n" || suffix === "big") {
            number = BigInt(number);
        }
        else if(suffix === "b") {
            number = parseInt(number, 2);
        }
        else {
            assert(!suffix, "Cannot handle numeric suffix: " + suffix);
            number = parseFloat(number);
        }
        Glint.console.log("COOL!", number, ";", suffix);
        return number;
    }
    
    parseRawString(token) {
        let string = token.value;
        return string
            .slice(1, -1)
            .replace(/\\(\\|\w+)/g, (whole, word) => word === "\\" ? "\\" : symbolFromName(word) ?? whole)
            .replace(/""/g, '"');
    }
    
    condenseCapturedOps(ops) {
        Glint.console.log("CONDENSED", ops.map(op => op.value));
        let fns = ops.map(op => (...args) => this.evalOp(op.value, args));
        let startingLength = fns.length;
        while(fns.length > 1) {
            let tail = fns.splice(-3);
            Glint.console.log("TAIL!", tail);
            let result;
            if(tail.length === 1) {
                result = tail[0];
            }
            else if(tail.length === 2) {
                result = (...args) => {
                    let head = args.length === 1 ? args : args.slice(0, -1);
                    Glint.console.log("head", head, "of", args);
                    return tail[0](...head, tail[1](args.at(-1)));
                };
            }
            else if(tail.length === 3) {
                result = (...args) => tail[1](tail[0](...args), tail[2](...args));
            }
            assert(result, `Error during condensation process`);
            
            fns.push(result);
        }
        assert(fns.length === 1, `Cannot capture ${startingLength} ops`);
        return new GlintFunction(fns[0])
            .setName(`[${ops.map(op => op.value).join(" ")}]`);
    }
    
    async evalTree(tree) {
        if(tree === undefined) {
            return;
        }
        let instruction = tree.value;
        let children = tree.children;
        Glint.console.log("Evaluating:", instruction, children);
        if(instruction.type === GlintTokenizer.Types.NUMBER) {
            return this.parseNumber(instruction);
        }
        if(instruction.type === GlintTokenizer.Types.STRING) {
            return this.parseRawString(instruction);
        }
        if(instruction.type === GlintTokenizer.Types.OPERATOR) {
            return this.evalTreeOp(instruction, children);
        }
        if(instruction.type === GlintTokenizer.Types.CLOSE_BRACKET) {
            // array
            Glint.console.log("CHILDREN OF THE CLOSE BRACKET?", children);
            return mapInSeries(children, child => this.evalTree(child));
        }
        if(instruction.type === GlintTokenizer.Types.WORD) {
            assert(Object.hasOwn(this.variables, instruction.value), "Undefined variable " + instruction.value);
            let variable = this.variables[instruction.value];
            if(children !== null) {
                // TODO: custom function hold arguments
                children = await mapInSeries(children, child => this.evalTree(child));
            }
            if(children === null) {
                return variable;
            }
            else if(Glint.isFunction(variable)) {
                return variable.apply(this, children);
            }
            else {
                return Glint.accessIndex(variable, children);
            }
        }
        if(instruction.type === GlintTokenizer.Types.OP_CAPTURE) {
            let fn = this.condenseCapturedOps(instruction.groups);
            if(children) {
                // TODO: do we need to await this?
                // children = await mapInSeries(children, child => this.evalTree(child));
                Glint.console.log("CHILDREN", children);
                return fn.apply(this, children);
            }
            else {
                return fn;
            }
        }
        assert(false, `Could not handle operator type ${instruction.type.toString()} ${Glint.display(instruction)}`);
    }
    
    // may return a promise
    async eval(string) {
        let trees = this.makeTree(string);
        
        let resultValue = null;
        for(let tree of trees) {
            resultValue = await this.evalTree(tree);
        }
        
        return resultValue;
    }
}

Glint.tokenize = string => {
    let tokenizer = new GlintTokenizer(string);
    return tokenizer.getTokens();
};

Glint.GlintInterpreter = GlintInterpreter;
Glint.GlintFunction = GlintFunction; 
Glint.GlintTokenizer = GlintTokenizer;
Glint.GlintShunting = GlintShunting;
Glint.AssertionError = AssertionError;

if(typeof module !== "undefined") {
    module.exports = Glint;
    
    if(require.main === module) {
        
        const readline = require("readline");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        // node.js testing
        // TODO: validate and exclude cases like "3 4 +" being valid
        let interpreter = new GlintInterpreter();
        interpreter.loadStandardLibrary();
        
        let index = 0;
        let IN = [];
        let OUT = [];
        
        interpreter.variables.IN = [];
        interpreter.variables.OUT = [];
        
        const repl = async () => {
            while(true) {
                let answer = await new Promise(resolve => rl.question(` IN(${index}) := `, resolve));
                
                IN.push(answer);
                interpreter.variables.IN = [...IN];
                
                if(answer === "exit") {
                    rl.close();
                    break;
                }
                
                let result;
                try {
                    result = await interpreter.eval(answer);
                }
                catch(e) {
                    result = e;
                }
                console.log(`OUT(${index}) := ${Glint.display(result)}`);
                console.log();
                index++;
                
                OUT.push(result);
                interpreter.variables.OUT = [...OUT];
            }
        };
        
        repl();
    }
    
    // for(let s of process.argv.slice(2)) {
        // console.log("Input: ", s);
        // console.log("Output: ", await interpreter.eval(s));
    // }
    
    /*
    for(let s of `
        sin(3)
        15% of 3
        10% of 7,070,795 * 2
        3^2^3
    `.trim().split("\n").map(e => e.trim())) {
        console.log(s);
        console.log(await interpreter.eval(s));
        console.log();
    }
    */
    
    /*
    
    // f ( ( g ( 3 ) ) ; h ( 4 ) ) * 2
    for(let s of `
        f(g 3; -h 4) * 2
        f((g 3); -h 4) * 2
        f(2+g h 3)
        3 + sin 4 * 5
        +/---*(3 + /4)
        f(2+g(h(3)))
        f(x; y + 2; z)
        3 + sin(4)
        1 + 1 * 2 * 3 / 4 * 5
        4 + -5 * * 3
        -3 + 4 * -(3 + 4)
        3 + f(4)
        3 + 4 * 5 * (3 + 4) ^ 3 ^ 2 - 5
        x% of y
        1,345,235
        3 + f a + 2
        print(3; 4)
    `.trim().split("\n").map(e => e.trim())) {
        let tokens = Glint.tokenize(s);
        // console.log(s, "=>", tokens);
        console.log(s);
        let shunter = new GlintShunting(tokens);
        let result = shunter.shuntingYard();
        console.log(shunter.debugOutputQueue());
        console.log();
    }
    */
}
