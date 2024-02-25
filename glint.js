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


Glint.DataTypes = {
    INT:        0b00000001,
    FLOAT:      0b00000010,
    BIGINT:     0b00000100,
    STRING:     0b00001000,
    LIST:       0b00010000,
    OBJECT:     0b00100000,
    FUNCTION:   0b01000000,
};
Glint.DataTypes.INT_LIKE = Glint.DataTypes.INT | Glint.DataTypes.BIGINT;
Glint.DataTypes.NUMBER_LIKE = Glint.DataTypes.INT | Glint.DataTypes.FLOAT | Glint.DataTypes.BIGINT;

Glint.typeOf = arg => {
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
    if(typeof arg === "function") {
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

Glint._display = (value, ancestors = []) => {
    if(value instanceof Error) {
        return "Internal Error: " + value;
    }
    if(typeof value === "symbol") {
        return value.toString();
    }
    if(ancestors.includes(value)) {
        console.log(ancestors, value);
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
    if(Number.isNaN(value)) {
        return "nan";
    }
    if(value === Infinity) {
        return "inf";
    }
    if(value === -Infinity) {
        return "-inf";
    }
    if(value === undefined) {
        return "undef";
    }
    if(typeof value === "function") {
        // TODO: better information
        return `<fn @ ${value.length || "?"}>`;
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
        [ /(_?(?:[\d,]+\.[\d,]*|\.[\d,]+|[\d,]+\.?))(deg|n|b|big)?/, GlintTokenizer.Types.NUMBER ],
        [ /%\s*of|<=>|\|>|[:<>!]=|[-+\/%*^=<>!@#]|:|`\w+`/, GlintTokenizer.Types.OPERATOR ],
        [ /[.]/, GlintTokenizer.Types.ADVERB ],
        [ /\w+/, GlintTokenizer.Types.WORD ],
        [ /[ \t]+/, GlintTokenizer.Types.WHITESPACE ],
        [ /;/, GlintTokenizer.Types.SEPARATOR ],
        [ /\(/, GlintTokenizer.Types.OPEN_PAREN ],
        [ /\)/, GlintTokenizer.Types.CLOSE_PAREN ],
        [ /\[/, GlintTokenizer.Types.OPEN_BRACKET ],
        [ /\]/, GlintTokenizer.Types.CLOSE_BRACKET ],
        [ /\{/, GlintTokenizer.Types.OPEN_BRACE ],
        [ /\}/, GlintTokenizer.Types.CLOSE_BRACE ],
        [ /"(?:[^"]|"")+"/, GlintTokenizer.Types.STRING ],
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
        console.log("Parenthesized:", this.tokens.filter(e=>e.type!==GlintTokenizer.Types.WHITESPACE).map(e => e.value).join` `);
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
        assert(this.operatorStack.length > 0, `Error: Could not find matching flush target ${Glint.display(types)}`);
    }
    
    flagDataForTopArity() {
        if(this.arityStack.length > 0 && this.arityStack.at(-1) === 0) {
            this.arityStack[this.arityStack.length - 1] = 1;
        }
    }
    
    parseToken(token) {
        console.log("!!!! parsing", token.type, token.value);
        console.log("Op stack:", this.operatorStack.map(e => e.value));
        console.log("Arity stack:", this.arityStack);
        if(this.isData(token)) {
            this.outputQueue.push(token);
            // operators following data are binary
            // e.g. 3 + 5
            this.nextOpArity = 2;
            // we have data: make sure the arity is at least 1
            this.flagDataForTopArity();
            this.nextParenIsFunctionCall = true;
        }
        else if(token.type === GlintTokenizer.Types.ADVERB) {
            this.adverbStack.push(token);
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
                adverbs: this.adverbStack.splice(0),
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
                if(typeof functionHandle.arity === "undefined") {
                    let functionToken = {
                        ...functionHandle,
                        arity: 0,
                    };
                    this.operatorStack.push(functionToken);
                }
                else {
                    this.outputQueue.push(functionHandle);
                    this.operatorStack.push({
                        type: GlintTokenizer.Types.OPERATOR,
                        value: "@",
                        arity: 1, // add 1 because we are gonna have another item on stack
                    });
                }
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
                // console.log("handling function call", this.operatorStack.at(-1));
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
        }
        else {
            assert(false, `Unhandled token: ${Glint.display(token)}`);
        }
    }
    
    shuntingYard() {
        for(let token of this.tokens) {
            this.parseToken(token);
        }
        
        // flush
        while(this.operatorStack.length > 0) {
            this.outputQueue.push(this.operatorStack.pop());
        }

        console.log("Shunting yard:", this.debugOutputQueue());
        
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
    "mdash": "—",
    "n": "\n",
    "r": "\r",
    "t": "\t",
};
const symbolFromName = name => {
    return SYMBOL_MAP[name];
};

class GlintInterpreter {
    constructor() {
        this.variables = {
            true: true,
            false: false,
            null: null,
            undef: undefined,
            nan: NaN,
            inf: Infinity,
        };
    }
    
    loadStandardLibrary() {
        Object.assign(this.variables, {
            SYMBOL_MAP,
            sym: symbolFromName,
            deg: n => n * Math.PI / 180,
            c: (...args) => args,
            pi: Math.PI,
            e: Math.E,
            sum: x => x.reduce((p, c) => p + c, 0),
            size: x => x.length ?? x.size,
            range: Glint.range,
            sort: Glint.sort,
            big: n => BigInt(n),
        });
        let mathWords = [
            "sin", "cos", "tan", "sinh", "cosh", "tanh"
        ];
        for(let word of mathWords) {
            this.variables[word] = Math[word];
        }
    }
    
    assertArity(instruction, args, expectedArity) {
        assert(
            args.length === expectedArity,
            `Could not call arity-${expectedArity} operator ${instruction} as arity-${args.length}. Parameters: ${args.map(Glint.display).join("; ")}`
        );
    }
    
    evalOp(value, args) {
        if(value === ":=") {
            let [ varName, value ] = args;
            if(varName.value.arity !== undefined) {
                // function definition
                let params = varName.children.map(child => child.value.value);
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
                this.variables[varName.value.value] = fn;
                return fn;
            }
            else {
                assert(varName.children === null, "Cannot handle nested assignment expression");
                value = this.evalTree(value);
                this.variables[varName.value.value] = value;
                return value;
            }
        }
        
        if(value[0] === "`") {
            let functionName = value.slice(1, -1);
            let fn = this.variables[functionName];
            return fn(...args);
        }
        
        if(value === "%of") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            // return x * y / 100;
            return this.evalOp("/", [ this.evalOp("*", [ x, y ]), 100 ]);
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
            else {
                assert(false, `Cannot multiply types ${Glint.getDebugTypes(...args)}`);
            }
        }
        
        if(value === "/") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(Glint.isList(x) && Glint.isFunction(y)) {
                return x.reduce((p, c) => y(p, c));
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
        
        if(value === "|>") {
            this.assertArity(value, args, 2);
            let [ x, y ] = args;
            if(Glint.isFunction(y)) {
                return y(x);
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
            return Glint.accessIndex(base, indices);
        }
        
        if(value === ":") {
            let [ x, y ] = args;
            return args;
            if(args.length === 1) {
                return [ x ];
            }
            else {
                return [ x, y ];
                // return [
                    // ...(Array.isArray(x) ? x : [x]),
                    // y
                // ];
            }
        }
        
        assert(false, `Could not handle instruction ${value}@${args.length}`);
    }
    
    broadcast(fn, args) {
        if(args.length === 0) {
            return fn();
        }
        else if(args.length === 1) {
            let [ xs ] = args;
            return xs.map
                ? xs.map(x => this.broadcast(fn, [ x ]))
                : fn(xs);
        }
        else if(args.length === 2) {
            let [ xs, ys ] = args;
            return xs.map && ys.map
                ? xs.map((x, idx) => this.broadcast(fn, [ x, ys[idx] ]))
                : xs.map
                    ? xs.map(x => this.broadcast(fn, [ x, ys ]))
                    : ys.map
                        ? ys.map(y => this.broadcast(fn, [ xs, y ]))
                        : fn(xs, ys);
        }
        else {
            assert(false, `Cannot broadcast with ${args.length} arguments yet`);
        }
    }
    
    evalTreeOp(instruction, args) {
        let { value, arity, adverbs } = instruction;
        adverbs ??= [];
        
        let hold = args.map(() => false);
        
        // TODO: custom hold
        if(value === ":=") {
            hold[0] = true;
            hold[1] = true;
        }
        
        args = args.map((arg, idx) => hold[idx] ? arg : this.evalTree(arg));
        
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
            console.log("Making tree instruction", Glint.display(instruction));
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
        assert(treeStack.length <= 1,
            `Expected exactly 0 or 1 expressions on the treeStack at the end, got ${treeStack.length}`);
        return treeStack[0];
    }
    
    parseNumber(token) {
        console.log(token);
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
        console.log("COOL!", number, ";", suffix);
        return number;
    }
    
    parseRawString(token) {
        let string = token.value;
        return string.slice(1, -1).replace(/\\(\\|\w+)/g,
            (whole, word) => word === "\\" ? "\\" : symbolFromName(word) ?? whole);
    }
    
    condenseCapturedOps(ops) {
        console.log("CONDENSED", ops.map(op => op.value));
        let fns = ops.map(op => (...args) => this.evalOp(op.value, args));
        let startingLength = fns.length;
        while(fns.length > 1) {
            let tail = fns.splice(-3);
            console.log("TAIL!", tail);
            let result;
            if(tail.length === 1) {
                result = tail[0];
            }
            else if(tail.length === 2) {
                result = (...args) => {
                    let head = args.length === 1 ? args : args.slice(0, -1);
                    console.log("head", head, "of", args);
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
        return fns[0];
    }
    
    evalTree(tree) {
        if(tree === undefined) {
            return;
        }
        let instruction = tree.value;
        let children = tree.children;
        console.log("Evaluating:", instruction, children);
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
            console.log("CHILDREN OF THE CLOSE BRACKET?", children);
            return children.map(child => this.evalTree(child));
        }
        if(instruction.type === GlintTokenizer.Types.WORD) {
            assert(Object.hasOwn(this.variables, instruction.value), "Undefined variable " + instruction.value);
            let variable = this.variables[instruction.value];
            if(children === null) {
                return variable;
            }
            else if(typeof variable === "function") {
                // TODO: function hold arguments
                children = children.map(child => this.evalTree(child));
                return variable.apply(this, children);
            }
            else {
                children = children.map(child => this.evalTree(child));
                return Glint.accessIndex(variable, children);
            }
        }
        if(instruction.type === GlintTokenizer.Types.OP_CAPTURE) {
            let fn = this.condenseCapturedOps(instruction.groups);
            if(children) {
                // children = children.map(child => this.evalTree(child));
                console.log("CHILDREN", children);
                return fn(...children);
            }
            else {
                return fn;
            }
        }
        assert(false, `Could not handle operator type ${instruction.type.toString()} ${Glint.display(instruction)}`);
    }
    
    eval(string) {
        let tree = this.makeTree(string);
        return this.evalTree(tree);
    }
}

Glint.tokenize = string => {
    let tokenizer = new GlintTokenizer(string);
    return tokenizer.getTokens();
};

if(typeof module !== "undefined") {
    module.exports = Glint;
    
    // node.js testing
    // TODO: validate and exclude cases like "3 4 +" being valid
    let interpreter = new GlintInterpreter();
    interpreter.loadStandardLibrary();
    for(let s of process.argv.slice(2)) {
        console.log("Input: ", s);
        console.log("Output: ", interpreter.eval(s));
    }
    
    /*
    for(let s of `
        sin(3)
        15% of 3
        10% of 7,070,795 * 2
        3^2^3
    `.trim().split("\n").map(e => e.trim())) {
        console.log(s);
        console.log(interpreter.eval(s));
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
