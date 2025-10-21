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
        let inner = fn.callPermissive
            ? await fn.callPermissive(self, el, idx, base)
            : await fn.call(self, el, idx, base);
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
Glint.accessIndex = (base, indices) => {
    if(indices.length === 1) {
        let [ index ] = indices;
        if(Array.isArray(index)) {
            assert(base.slice, `Cannot slice into ${Glint.getDebugTypes([ base ])}`);
            return base.slice(...index);
        }
        if(base.at) {
            return base.at(index);
        }
        return base[index];
    }
    else {
        return Glint.accessIndex(Glint.accessIndex(base, [ indices[0] ]), indices.slice(1));
    }
};

const NO_OP = () => {};
Glint.console = {
    _silent: true,
    set silent(v) {
        this._silent = v;
        if(this._silent) {
            this.log = NO_OP;
            this.warn = NO_OP;
            this.info = NO_OP;
            this.error = NO_OP;
        }
        else {
            this.log = console.log.bind(console);
            this.warn = console.warn.bind(console);
            this.info = console.info.bind(console);
            this.error = console.error.bind(console);
        }
    },
    get silent() {
        return this._silent;
    }
};
Glint.console.silent = true;

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
        Glint.console.log(value);
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
    static NO_SEED = Symbol("GlintFunction.NO_SEED");
    constructor(fn) {
        this.fn = fn;
        this.name = "anonymous";
        this.arity = null;
        this.maxArity = null;
        this.signature = null; // todo
        this.seed = GlintFunction.NO_SEED; // used in reductions
    }
    
    setName(name) {
        this.name = name;
        return this;
    }
    
    setFn(fn) {
        this.fn = fn;
        return this;
    }
    
    setArity(arity) {
        this.arity = arity;
        this.maxArity = Array.isArray(arity) ? Math.max(...arity) : arity;
        return this;
    }
    
    setSeed(seed) {
        this.seed = seed;
        return this;
    }
    
    copy() {
        let res = new GlintFunction(this.fn);
        Object.assign(res, this);
        return res;
    }
    
    call(thisRef, ...args) {
        return this.fn.call(thisRef, ...args);
    }
    
    apply(thisRef, args = []) {
        return this.fn.apply(thisRef, args);
    }
    
    fixArity(args) {
        return args.slice(0, this.maxArity ?? args.length);
    }
    
    callPermissive(thisRef, ...args) {
        return this.fn.call(thisRef, ...this.fixArity(args));
    }
    
    applyPermissive(thisRef, ...args) {
        return this.fn.apply(thisRef, this.fixArity(args));
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
            if(!Object.hasOwn(b, key)) {
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

// TODO: comprehensible error checking for unbalanced parens, including:
// `}`, `{`, `(]`, `[(])`

// TODO: allow ! in words like ruby
const WORD_REGEX = /\w+!?/;
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
    
    // sentinel used in flushing
    static PROGRAM_START = Symbol("GlintTokenizer.PROGRAM_START");
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
        LAMBDA: Symbol("GlintTokenizer.Types.LAMBDA"),
        LINEBREAK: Symbol("GlintTokenizer.Types.LINEBREAK"),
    };
    // TODO: accept custom operators
    // final operator names have all whitespace removed
    static Regexes = [
        // TODO: better comma-in-number verification (e.g. ,,,3., shouldn't be a valid number)
        [ /(_?(?:[\d,]+(?:\.[\d,]+)?|\.[\d,]+))(deg|n|b|big)?/, GlintTokenizer.Types.NUMBER ],
        [ /%\s*of|<=>|\|>|[:<>!]=|[-+\\/%*^=<>!@#|]|:|`\w+`/, GlintTokenizer.Types.OPERATOR ],
        [ /[.&]/, GlintTokenizer.Types.ADVERB ],
        [ WORD_REGEX, GlintTokenizer.Types.WORD ],
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
                // remove whitespace; normalize e.g. "%  of" -> "%of"
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
        
        // second pass: coalesce lambda groups { 2 * + } e.g. to {} (groups 2,*,+)
        let iterate = this.tokens.splice(0);
        let buildStack = [];
        for(let token of iterate) {
            let pushToken = null;
            if(token.type === GlintTokenizer.Types.OPEN_BRACE) {
                buildStack.push([]);
            }
            else if(token.type === GlintTokenizer.Types.CLOSE_BRACE) {
                let groups = buildStack.pop();
                
                let firstColonIndex = groups.findIndex(c => c.value === ":");
                let isValidExplicitLambda = false;
                if(firstColonIndex !== -1) {
                    // explicit lambda
                    let args = groups.slice(0, firstColonIndex)
                        .map(arg => arg.value)
                        .filter(arg => /\S/.test(arg));
                    // TODO: more sophisticated argument checking
                    // TODO: pattern matching expressions in args?? idk
                    let isValidExplicitLambda = args.every((e, idx) =>
                        idx % 2 === 0
                            ? e.match(WORD_REGEX)?.[0] === e
                            : e === ";"
                    );
                    if(isValidExplicitLambda) {
                        let body = groups.slice(firstColonIndex + 1);
                        
                        pushToken = [
                            {
                                type: GlintTokenizer.Types.LAMBDA,
                                explicit: true,
                                value: "{}",
                                groups: args.filter(arg => arg !== ";")
                            },
                            {
                                type: GlintTokenizer.Types.OPEN_BRACE,
                                value: "{",
                            },
                            ...body,
                            {
                                type: GlintTokenizer.Types.CLOSE_BRACE,
                                value: "}",
                            },
                        ];
                    }
                }
                
                // if we did not already set an explicit lambda
                if(!pushToken) {
                    pushToken = {
                        type: GlintTokenizer.Types.LAMBDA,
                        explicit: false,
                        value: "{}",
                        groups,
                    };
                }
            }
            else {
                pushToken = token;
            }
            
            if(pushToken !== null) {
                if(!Array.isArray(pushToken)) {
                    pushToken = [ pushToken ];
                }
                if(buildStack.length) {
                    buildStack.at(-1).push(...pushToken);
                }
                else {
                    this.tokens.push(...pushToken);
                }
            }
        }
        
        Glint.console.log(this.tokens);
        
        return this.tokens;
    }
}

class GlintShunting {
    // TODO: chaining comparisons? e.g. a < b < c is equiv. to a < b && b < c?
    static Precedence = {
        "(":    { precedence: -10,  associativity: "left" },
        "[":    { precedence: -10,  associativity: "left" },
        "{":    { precedence: -10,  associativity: "left" },
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
        ".":    { precedence: 8000, associativity: "left" },
        "@":    { precedence: 90,   associativity: "left" },
    };
    
    static isData(token) {
        return token.type === GlintTokenizer.Types.NUMBER
            || token.type === GlintTokenizer.Types.WORD
            || token.type === GlintTokenizer.Types.STRING
            || token.type === GlintTokenizer.Types.LAMBDA;
    }
    
    static isDataStart(token) {
        return GlintShunting.isData(token)
            || token.type === GlintTokenizer.Types.OPEN_BRACKET
            // || token.type === GlintTokenizer.Types.OPEN_PAREN // XXX: we do NOT want to wrap every function call with extra parentheses, as this induces wrong behavior
            || token.type === GlintTokenizer.Types.OPEN_BRACE;
    }
    
    static shouldSkip(token) {
        return token.type === GlintTokenizer.Types.WHITESPACE;
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
        // used both for static checking of valid adverbs, and contextually determine the meaning of "."
        // either is null, or a string
        this.lastAdverb = null;
        // used for verifying balanced parens
        // (does not verify in the case of e.g. `({)}` currently.)
        this.depths = {
            paren: 0,
            brace: 0,
            bracket: 0,
        };
        this.autoInsertParentheses();
    }
    
    getDepthSum() {
        return Object.values(this.depths).reduce((p, c) => p + c, 0);
    }
    
    updateDepths(token, check = true) {
        if(token.type === GlintTokenizer.Types.OPEN_BRACE) {
            this.depths.brace++;
        }
        else if(token.type === GlintTokenizer.Types.OPEN_BRACKET) {
            this.depths.bracket++;
        }
        else if(token.type === GlintTokenizer.Types.OPEN_PAREN) {
            this.depths.paren++;
        }
        else if(token.type === GlintTokenizer.Types.CLOSE_BRACE) {
            this.depths.brace--;
        }
        else if(token.type === GlintTokenizer.Types.CLOSE_BRACKET) {
            this.depths.bracket--;
        }
        else if(token.type === GlintTokenizer.Types.CLOSE_PAREN) {
            this.depths.paren--;
        }
        
        if(check) {
            assert(this.depths.paren >= 0, "Extra closing parenthesis )");
            assert(this.depths.brace >= 0, "Extra closing brace }");
            assert(this.depths.bracket >= 0, "Extra closing bracket ]");
        }
    }
    
    // transforms expressions like `3 + f 4 * 5` to `3 + f(4 * 5)`
    autoInsertParentheses() {
        for(let i = 0; i < this.tokens.length; i++) {
            let token = this.tokens[i];
            
            let startDepth = {...this.depths};
            this.updateDepths(token);
            let continueDepths = {...this.depths};
            
            // console.log("token:", token.value);
            
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
                
                // console.log("Starting auto insert", token.value, nextToken.value, startDepth, continueDepths);
                
                // insert open parenthesis before j
                this.tokens.splice(j, 0, {
                    type: GlintTokenizer.Types.OPEN_PAREN,
                    value: "(",
                    groups: [],
                });
                // find relative end of expression
                let k = j + 1;
                while(k < this.tokens.length) {
                    let token = this.tokens[k];
                    // console.log("inner token:", token.value, this.depths, startDepth);
                    // check before updating depths; this is where we want to set our inserted parenthesis
                    if([
                        GlintTokenizer.Types.CLOSE_PAREN,
                        GlintTokenizer.Types.CLOSE_BRACE,
                        GlintTokenizer.Types.CLOSE_BRACKET,
                    ].includes(token.type)) {
                        // console.log("start test", this.tokens.slice(0, k).map(e=>e.value).join``, this.depths, startDepth);
                        if(this.depths.paren === startDepth.paren
                        && this.depths.brace === startDepth.brace
                        && this.depths.bracket === startDepth.bracket) {
                            break;
                        }
                    }
                    this.updateDepths(token);
                    k++;
                }
                // restore original depths, since we continue iterating with the next token
                this.depths = continueDepths;
                // insert corresponding close parenthesis
                this.tokens.splice(k, 0, {
                    type: GlintTokenizer.Types.CLOSE_PAREN,
                    value: ")",
                    groups: [],
                });
            }
        }
        
        assert(this.depths.paren === 0, "Insufficient closing parenthesis )");
        assert(this.depths.brace === 0, "Insufficient closing brace }");
        assert(this.depths.bracket === 0, "Insufficient closing bracket ]");

        Glint.console.log("Parenthesized:", this.tokens.filter(e=>e.type!==GlintTokenizer.Types.WHITESPACE).map(e => e.value).join` `);
    }
    
    isData(token) {
        return GlintShunting.isData(token);
    }
    
    isDataStart(token) {
        return GlintShunting.isDataStart(token);
    }
    
    shouldSkip(token) {
        return GlintShunting.shouldSkip(token);
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
    
    flushTo(...types) {
        while(
            this.operatorStack.length > 0
            && !types.includes(this.operatorStack.at(-1).type)
        ) {
            this.outputQueue.push(this.operatorStack.pop());
        }
        assert(types.length === 0
            || types.includes(GlintTokenizer.PROGRAM_START)
            || this.operatorStack.length > 0,
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
    
    nextState({ opArity, parenIsFunctionCall, lastWasData }) {
        assert(opArity !== undefined, "Expected opArity");
        assert(parenIsFunctionCall !== undefined, "Expected parenIsFunctionCall");
        assert(lastWasData !== undefined, "Expected lastWasData");
        this.nextOpArity = opArity;
        this.nextLastWasData = lastWasData;
        this.nextParenIsFunctionCall = parenIsFunctionCall;
    }
    
    parseToken(token) {
        assert(token, `Cannot call parseToken with non-truthy token '${token}'`);
        assert(token.type, `Token must have associated type; got '${token.type?.toString()}' of ${JSON.stringify(token)}`);
        
        Glint.console.log("!!!! parsing", token.type, token.value);
        Glint.console.log("Op stack:", this.operatorStack.map(e => e.value));
        Glint.console.log("Arity stack:", this.arityStack);
        
        // this.debug();
        
        this.nextLastWasData = false;
        let skipped = false;
        let nextLastAdverb = null;
        let acceptsAdverb = false;
        
        if(this.isData(token)) {
            if(this.lastWasData) {
                let message = "Illegal to have two consecutive pieces of data";
                if(token.value === ",") {
                    message += "\nSuggestion: Did you mean `;` instead of `,`?";
                }
                assert(false, message);
            }
            if(this.lastAdverb === ".") {
                // before we do anything, we know this must be a property thing
                let dotToken = this.adverbStack.pop();
                dotToken.type = GlintTokenizer.Types.OPERATOR;
                Glint.console.log("DOT TOKEN:", dotToken);
                this.parseToken(dotToken);
            }
            this.assertNoAdverbs();
            this.outputQueue.push(token);
            this.nextState({
                // operators following data are binary
                // e.g. 3 + 5
                opArity: 2,
                parenIsFunctionCall: true,
                lastWasData: true,
            });
            // we have data: make sure the arity is at least 1
            // this differentiates between e.g. f("lol") and f()
            this.flagDataForTopArity();
        }
        else if(token.type === GlintTokenizer.Types.ADVERB) {
            this.adverbStack.push(token);
            nextLastAdverb = token.value;
            acceptsAdverb = true;
            // don't rock the boat: we don't modify the tracking state
            // TODO: error if next is not verb
        }
        else if(token.type === GlintTokenizer.Types.LINEBREAK) {
            if(this.getDepthSum() === 0) {
                // only break if we're not in the middle of any expression expecting an end
                Glint.console.log("separator encountered");
                this.flushTo();
                this.nextState({
                    opArity: 1,
                    parenIsFunctionCall: false,
                    lastWasData: false,
                });
            }
            else {
                // we should treat this like a semicolon in this context
                this.flushTo(
                    GlintTokenizer.Types.OPEN_PAREN,
                    GlintTokenizer.Types.OPEN_BRACKET,
                    GlintTokenizer.Types.OPEN_BRACE,
                );
            }
        }
        else if(token.type === GlintTokenizer.Types.SEPARATOR) {
            // separates function arguments
            // console.log("Sep stack", this.operatorStack);
            this.flushTo(
                GlintTokenizer.Types.OPEN_PAREN,
                GlintTokenizer.Types.OPEN_BRACKET,
                GlintTokenizer.Types.OPEN_BRACE,
                GlintTokenizer.PROGRAM_START,
                // TODO: check if brace is needed?
            );
            // console.log("Sep stack", this.operatorStack);
            
            let inLambda = this.operatorStack.at(-1)?.type === GlintTokenizer.Types.OPEN_BRACE;
            let inFunctionCall = this.arityStack.length > 0;
            // console.log(inLambda, inFunctionCall);
            // assert(inLambda || inFunctionCall, "Unexpected separator outside function call/lambda");
            
            if(!inLambda && inFunctionCall) {
                this.arityStack[this.arityStack.length - 1]++;
                
                this.nextState({
                    opArity: 1,
                    parenIsFunctionCall: false,
                    lastWasData: false,
                });
            }
        }
        else if(token.type === GlintTokenizer.Types.OPERATOR) {
            acceptsAdverb = true;
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
            this.nextState({
                opArity: 1,
                parenIsFunctionCall: false,
                lastWasData: false,
            });
        }
        else if(token.type === GlintTokenizer.Types.OPEN_PAREN) {
            // TODO: figure out why a.b(c) doesn't work
            if(this.nextParenIsFunctionCall) {
                // handle function call case
                // XXX: it's probably sinful to pop from the outputQueue but whatever.
                // TODO: allow adverbs to apply to function callers
                let functionHandle = this.outputQueue.pop();
                Glint.console.log("Opcall function handle:", functionHandle);
                /*
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
                // handle a.b.c...(d)
                while(this.operatorStack.at(-1)?.value == ".") {
                    this.outputQueue.push(this.operatorStack.pop());
                }
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
            this.nextState({
                opArity: 1,
                parenIsFunctionCall: false,
                lastWasData: false,
            });
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
            this.nextState({
                // operators immediately following a close parenthesis must be binary
                // e.g. (3 * 5) - 6
                opArity: 2,
                // if we have a parenthetical after a parenthetical, interpret as call
                parenIsFunctionCall: true,
                lastWasData: true,
            });
            // this counts as data
            this.flagDataForTopArity();
        }
        else if(token.type === GlintTokenizer.Types.OPEN_BRACKET) {
            this.arityStack.push(0);
            this.operatorStack.push(token);
            this.nextState({
                // operators immediately following an open bracket are necessarily unary
                // e.g. [+3 * 5]
                opArity: 1,
                parenIsFunctionCall: false,
                lastWasData: false,
            });
        }
        else if(token.type === GlintTokenizer.Types.CLOSE_BRACKET) {
            let startFlushIndex = this.operatorStack.length;
            this.flushTo(GlintTokenizer.Types.OPEN_BRACKET);
            let opsFlushed = startFlushIndex - this.operatorStack.length;
            
            this.operatorStack.pop();
            
            let arity = this.arityStack.pop();
            if(arity === 0 && opsFlushed > 0) {
                assert(false, "Capture op [...] not currently implemented.");
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
            this.nextState({
                opArity: 2,
                // []() is an indexing/call expression
                parenIsFunctionCall: true,
                lastWasData: true,
            });
            this.flagDataForTopArity();
        }
        else if(token.type === GlintTokenizer.Types.OPEN_BRACE) {
            // explicit lambda body
            this.operatorStack.push({
                ...token,
                outputQueueStartIndex: this.outputQueue.length,
            });
            this.nextState({
                opArity: 1,
                parenIsFunctionCall: false,
                lastWasData: false,
            });
        }
        else if(token.type === GlintTokenizer.Types.CLOSE_BRACE) {
            this.flushTo(GlintTokenizer.Types.OPEN_BRACE);
            let brace = this.operatorStack.pop();
            let body = this.outputQueue.splice(brace.outputQueueStartIndex);
            let lambda = this.outputQueue.pop();
            Glint.console.log("!! args", lambda.groups);
            Glint.console.log("!! body", body);
            this.outputQueue.push({
                ...lambda,
                groups: [ lambda.groups, body ],
            });
            this.nextState({
                opArity: 2,
                parenIsFunctionCall: true,
                lastWasData: true,
            });
            this.flagDataForTopArity();
        }
        else if(this.shouldSkip(token)) {
            // do nothing
            skipped = true;
        }
        else {
            assert(false, `Unhandled token: ${Glint.display(token)}`);
        }
        this.updateDepths(token);
        
        if(!skipped) {
            assert(this.lastAdverb === null || acceptsAdverb, `Cannot have adverb before ${token.type.toString()}`);
            this.lastWasData = this.nextLastWasData;
            this.lastAdverb = nextLastAdverb;
        }
    }
    
    assertFullOperands() {
        let mockQueue = [...this.outputQueue];
        
        Glint.console.log("HELP WHAT:", this.debugOutputQueue(), mockQueue);
        let stackSize = 0;
        mockQueue.forEach(token => {
            // console.log("token:", token);
            // console.log("size", stackSize);
            if(typeof token.arity !== "undefined") {
                // TODO: inspect what arities the operator expects for error reporting, e.g. "expected 1 or 2" for "-"
                assert(stackSize >= token.arity, `Insufficient operands for operator ${token.value}, expected ${token.arity}, got ${stackSize}`);
                stackSize -= token.arity;
                stackSize++;
            }
            else {
                stackSize++;
            }
            // console.log("size after", stackSize);
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
        assert(this.arityStack.length === 0, "Unpopped arity");

        Glint.console.log("Shunting yard:", this.debugOutputQueue());
        
        // this.debug();
        
        return this.outputQueue;
    }
    
    debugOperatorStack() {
        return this.operatorStack
            .map((e, i) => {
                let arity = this.arityStack[i] ?? e.arity;
                if(arity !== undefined) {
                    return `${e.value}@${arity}`;
                }
                return e.value;
            })
            .join(" ");
    }
    
    debugOutputQueue() {
        return this.outputQueue
            .map(e => e.arity !== undefined ? e.value + "@" + e.arity : e.value)
            .join(" ");
    }
    
    debug() {
        console.log("Operator stack:", this.debugOperatorStack());
        console.log("Output queue:  ", this.debugOutputQueue());
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
    "geq": "≥",
    "leq": "≤",
    "approx": "≈",
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
    
    // define functions later
    static STANDARD_LIBRARY = {
        sym: symbolFromName,
        pi: Math.PI,
        e: Math.E,
    };
    loadStandardLibrary() {
        Object.assign(this.variables, {
            SYMBOL_MAP,
            ...GlintInterpreter.STANDARD_LIBRARY,
        });
        let mathWords = [
            "sin", "cos", "tan", "sinh", "cosh", "tanh",
            "asin", "acos", "atan", "asinh", "acosh", "atanh", "atan2",
            "random",
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
            Glint.console.log(":=", varDefinition, value);
            if(varDefinition.value.type === GlintTokenizer.Types.OPERATOR && varDefinition.value.value === "@") {
                // function definition
                let [ varName, ...varArgs ] = varDefinition.children;
                varName = varName.value.value;
                let params = varArgs.map(child => child.value.value);
                
                let fn = this.makeExplicitLambda(params, value);
                this.variables[varName] = fn.setName(varName);
                return this.variables[varName];
            }
            else {
                // regular variable assignment
                // TODO: there's something fishy here, as `x + y := 13` is not caught
                assert(varDefinition.children === null, "Cannot handle nested assignment expression");
                value = await this.evalTree(value);
                this.variables[varDefinition.value.value] = value;
                return value;
            }
        }
        
        if(value === "\\") {
            
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
                if("seed" in y && y.seed !== GlintFunction.NO_SEED) {
                    return x.reduce(async (p, c) => await y.call(this, await p, await c), y.seed);
                }
                else {
                    return x.reduce(async (p, c) => await y.call(this, await p, await c));
                }
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
            else if(Glint.isFunction(x)) {
                return x.copy().setSeed(y);
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
        
        if(value === ".") {
            let [ base, prop ] = args;
            prop = prop?.value?.value ?? prop;
            Glint.console.log("dot access", {base, prop});
            if(args.length === 1) {
                return new GlintFunction(function (obj) {
                    return this.evalOp(".", [ obj, base ]);
                })
                    .setName(`propda .${base}`)
                    .setArity(1);
            }
            else {
                // designed to facilitate common patterns of objects
                if(base.has) {
                    // has-get-at-subscript pattern (Set)
                    if(base.has(prop)) {
                        return base.get ? base.get(prop) : base.at ? base.at(prop) : base[prop];
                    }
                }
                else if(base.includes) {
                    // includes-at-subscript pattern (Array, String)
                    if(base.includes(prop)) {
                        return base.at ? base.at(prop) : base[prop];
                    }
                }
                else {
                    // hasOwn-subscript syntax (Object)
                    if(Object.hasOwn(base, prop)) {
                        return base[prop];
                    }
                }
                // if we fell through, handle Uniform Function Call Syntax syntax
                assert(Object.hasOwn(this.variables, prop), `Undefined function via UFCS ${prop}`);
                
                assert(Glint.isFunction(this.variables[prop]), `Cannot implement Uniform Function Call Syntax on non-function variable ${prop} (${this.variables[prop]})`);
                return new GlintFunction(function (...args) {
                    Glint.console.log("UFCS!", base, args);
                    return this.variables[prop].call(this, base, ...args);
                })
                    .setName(`UFCS ${base}.${prop}`);
                
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
    
    async evalTreeOp(instruction, args, evaluate = true) {
        let { value, /*arity,*/ adverbs } = instruction;
        adverbs ??= [];
        
        let hold = args.map(() => false);
        
        // TODO: custom hold
        if(value === ":=") {
            hold[0] = true;
            hold[1] = true;
        }
        if(value === ".") {
            hold[0] = false;
            hold[1] = true;
        }
        
        if(evaluate) {
            args = await mapInSeries(args,
                (arg, idx) => hold[idx] ? arg : this.evalTree(arg)
            );
        }
        
        if(adverbs.length === 0) {
            return this.evalOp(value, args);
        }
        else {
            // TODO: more generic system
            assert(adverbs.length === 1 && adverbs[0].value === ".", "Cannot handle other adverbs than `.` yet");
            return this.broadcast((...inner) => this.evalOp(value, inner), args);
        }
    }
    
    makeTree(rpn) {
        if(!Array.isArray(rpn)) {
            let tokenizer = new GlintTokenizer(rpn);
            let tokens = tokenizer.getTokens();
            let shunter = new GlintShunting(tokens);
            rpn = shunter.shuntingYard();
        }
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
        Glint.console.log("parseNumber token", token);
        assert(token.value !== ",", "Invalid number literal: `,`. Did you mean `;`?");
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
    
    static SEED_VALUES = {
        "+": 0,
        "-": 0,
        "*": 1,
    };
    async condenseCapturedOps(ops) {
        Glint.console.log(ops);
        Glint.console.log("CONDENSED", ops.map(op => op.value));
        let fns = [];
        let adverbStack = [];
        for(let token of ops) {
            if(GlintShunting.isData(token)) {
                fns.push({
                    nilad: true,
                    // TODO: figure out whether this actually supposed to bind to innermost this instance, or if it should instead be an arrow function
                    // this might be relevant to scope
                    fn: function (...args) { return this.evalTree({ value: token }); },
                });
            }
            else if(token.type === GlintTokenizer.Types.ADVERB) {
                adverbStack.push(token);
            }
            else if(token.type === GlintTokenizer.Types.OPERATOR) {
                let adverbs = adverbStack.splice(0);
                let fnElement = {
                    nilad: false,
                    fn: function (...args) {
                        return this.evalTreeOp(
                            {
                                ...token,
                                adverbs
                            },
                            args,
                            false
                        );
                    },
                }
                if(token.value in GlintInterpreter.SEED_VALUES) {
                    fnElement.seed = GlintInterpreter.SEED_VALUES[token.value];
                }
                fns.push(fnElement);
            }
            else if(GlintShunting.shouldSkip(token)) {
                // do nothing
            }
            else {
                assert(false, `Unexpected token encountered during condensation: ${JSON.stringify(token)}`);
            }
        }
        
        let glintFn = new GlintFunction(null)
            .setName(`{${ops.map(op => op.value).join(" ")}}`);
        
        assert(fns.length !== 0, "TODO: handle empty lambda");
        
        if(fns.length === 1) {
            glintFn.setFn(fns[0].fn);
            if("seed" in fns[0]) {
                glintFn.setSeed(fns[0].seed);
            }
        }
        else if(fns.length === 2) {
            let [ f, g ] = fns;
            Glint.console.log({f, g});
            if(f.nilad && g.nilad) {
                assert(false, "Cannot condense consecutive nilads");
            }
            else if(f.nilad && !g.nilad) {
                // e.g. {2/}
                glintFn.setFn(async function (...args) {
                    return g.fn.call(this, await f.fn.call(this), ...args);
                })
                    .setArity(1);
            }
            else if(!f.nilad && g.nilad) {
                // e.g. {-1}
                glintFn.setFn(async function (...args) {
                    return g.fn.call(this, ...args, await f.fn.call(this));
                })
                    .setArity(1);
            }
            else {
                assert(false, "No behavior implemented yet for consecutive functions");
            }
        }
        else {
            fns = fns.map(op => op.fn);
            while(fns.length > 1) {
                let tail = fns.splice(-3);
                let result;
                if(tail.length === 1) {
                    result = tail[0];
                }
                else if(tail.length === 2) {
                    let [ f, g ] = tail;
                    result = async function (...args) {
                        let head = args.length === 1 ? args : args.slice(0, -1);
                        Glint.console.log("head", head, "of", args);
                        return f.call(this,
                            ...head,
                            await g.call(this, args.at(-1))
                        );
                    };
                }
                else if(tail.length === 3) {
                    let [ f, g, h ] = tail;
                    result = async function (...args) {
                        return g.call(this,
                            await f.apply(this, args),
                            await h.apply(this, args)
                        );
                    };
                }
                assert(result, `Error during condensation process`);
                fns.push(result);
            }
            
            assert(fns.length === 1, "Error while condensing: Some functions not condensed, or no functions were left");
            glintFn.setFn(fns[0]);
        }
        
        assert(glintFn.fn !== null, "Have not handled this yet");
        
        return glintFn;
    }
    
    makeExplicitLambda(params, body) {
        return new GlintFunction(function (...args) {
            // TODO: better scoping
            // this.addLocalScope(Object.fromEntries(params.map((param, idx) => [ param, args[idx] ])));
            
            // for now, variables get set in GLOBAL SCOPE >:|
            params.forEach((param, idx) => {
                this.variables[param] = args[idx];
            });
            
            return this.evalTree(body);
            // this.removeLocalScope();
        })
            .setArity(params.length)
            .setName("{λ}");
    }
    
    async evalTree(tree) {
        // console.log("evalTree", tree.value, tree.children);
        if(tree === undefined) {
            return;
        }
        if(Array.isArray(tree)) {
            let value;
            for(let child of tree) {
                value = await this.evalTree(child);
            }
            return value;
        }
        let instruction = tree.value;
        let children = tree.children;
        Glint.console.log("Evaluating:", instruction, "with children", ...children ?? []);
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
        if(instruction.type === GlintTokenizer.Types.LAMBDA) {
            if(instruction.explicit) {
                let [ args, body ] = instruction.groups;
                let treeBody = this.makeTree(body);
                Glint.console.log(treeBody);
                return this.makeExplicitLambda(args, treeBody);
            }
            else {
                return this.condenseCapturedOps(instruction.groups);
            }
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
            let fn = await this.condenseCapturedOps(instruction.groups);
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
        assert(false, `Could not handle operator type ${instruction?.type?.toString()} ${Glint.display(instruction)}`);
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

GlintInterpreter.STANDARD_LIBRARY.parse_json =
    new GlintFunction(JSON.parse)
        .setName("parse_json")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.to_json =
    new GlintFunction(JSON.stringify)
        .setName("to_json")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.eye =
    new GlintFunction(n => {
        let res = Array(n);
        for(let i = 0; i < n; i++) {
            res[i] = Array(n);
            for(let j = 0; j < n; j++) {
                res[i][j] = i === j ? 1 : 0;
            }
        }
        return res;
    })
        .setName("eye")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.map =
    new GlintFunction(function (...args) {
        Glint.console.log("!! MAP !!", args);
        if(args.length === 1) {
            let fn = args[0];
            return new GlintFunction(function (arr) {
                Glint.console.log(this);
                return this.variables.map.call(this, arr, fn);
            })
                .setName(`map:${fn.name}`)
                .setArity(1);
        }
        assert(args.length === 2, "Incorrect number of arguments given to map (expected 1 or 2)");
        let [ arr, fn ] = args;
        Glint.console.log("arr:", arr);
        return mapInSeries.call(this, arr, fn);
    })
        .setName("map")
        .setArity([2, 1]);

GlintInterpreter.STANDARD_LIBRARY.zip =
    new GlintFunction(function (...args) {
        if(args.length === 0) {
            return [];
        }
        let smallest = Math.min(...args.map(arg => arg.length));
        let [ head, ...rest ] = args;
        return head.slice(0, smallest).map((el, idx) => [ el, ...rest.map(list => list[idx]) ]);
    })
        .setName("zip")
        .setArity(Infinity);

GlintInterpreter.STANDARD_LIBRARY.deg =
    new GlintFunction(n => n * Math.PI / 180)
        .setName("deg")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.c =
    new GlintFunction((...args) => args)
        .setName("c")
        .setArity(Infinity);

GlintInterpreter.STANDARD_LIBRARY.sum =
    new GlintFunction(x => x.reduce((p, c) => p + c, 0))
        .setName("sum")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.size =
    new GlintFunction(x => x.length ?? x.size)
        .setName("size")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.range =
    new GlintFunction(Glint.range)
        .setName("range")
        .setArity([1, 2, 3]);

GlintInterpreter.STANDARD_LIBRARY.sort =
    new GlintFunction(Glint.sort)
        .setName("sort")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.big =
    new GlintFunction(n => BigInt(n))
        .setName("big")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.uniq =
    new GlintFunction(s => [...new Set(s)])
        .setName("uniq")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.eval =
    new GlintFunction(GlintInterpreter.prototype.eval)
        .setName("eval")
        .setArity(1);

// TODO: overload for arrays
const split = (s, by) => {
    // TODO: generalize for sequences
    if(Array.isArray(s)) {
        let collected = [ [] ];
        s.forEach(el => {
            if(Glint.deepCompare(el, by) == 0) {
                collected.push([]);
            }
            else {
                collected.at(-1).push(el);
            }
        });
        return collected;
    }
    else {
        return s.split(by);
    }
};
GlintInterpreter.STANDARD_LIBRARY.split =
    new GlintFunction(split)
        .setName("split")
        .setArity(2);

GlintInterpreter.STANDARD_LIBRARY.join =
    new GlintFunction((a, by) => a.join(by))
        .setName("join")
        .setArity(2);

GlintInterpreter.STANDARD_LIBRARY.lines =
    new GlintFunction(s => s.split("\n"))
        .setName("lines")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.unlines =
    new GlintFunction(s => s.join("\n"))
        .setName("unlines")
        .setArity(1);

// TODO: make work for web version
GlintInterpreter.STANDARD_LIBRARY.print =
    new GlintFunction((...args) => console.log(...args.map(e => e.toString())))
        .setName("print")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.with_index =
    new GlintFunction((arr, n = 0) => arr.map((e, i) => [e, i + n]))
        .setName("with_index")
        .setArity([1, 2]);

GlintInterpreter.STANDARD_LIBRARY.index =
    new GlintFunction((arr, el) => {
        let index = arr.indexOf(el);
        return index === -1 ? null : index
    })
        .setName("index")
        .setArity(2);

GlintInterpreter.STANDARD_LIBRARY.prefixes =
    new GlintFunction(arr => arr.map((_, i) => arr.slice(0, i + 1)))
        .setName("prefixes")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.suffixes =
    new GlintFunction(arr => arr.map((_, i) => arr.slice(i)))
        .setName("prefixes")
        .setArity(1);

GlintInterpreter.STANDARD_LIBRARY.first =
    new GlintFunction((...args) => {
        if(args.length === 1) {
            return args[0].at(0);
        }
        else {
            // TODO: maybe we should allow bigints in these contexts
            let [ base, n ] = args;
            return base.slice(0, n);
        }
    })
        .setName("last")
        .setArity([1, 2]);

GlintInterpreter.STANDARD_LIBRARY.last =
    new GlintFunction((...args) => {
        if(args.length === 1) {
            return args[0].at(-1);
        }
        else {
            // TODO: maybe we should allow bigints in these contexts
            let [ base, n ] = args;
            if(n === 0) {
                return [];
            }
            return base.slice(-n);
        }
    })
        .setName("last")
        .setArity([1, 2]);

GlintInterpreter.STANDARD_LIBRARY.tee =
    new GlintFunction(function (base, fn) {
        fn.call(this, base);
        return base;
    })
        .setName("tee")
        .setArity(2);

GlintInterpreter.STANDARD_LIBRARY.each_cons =
    new GlintFunction((arr, by) => {
        assert(by > 0, `Invalid slice size ${by}`);
        return Glint.range(arr.length - by + 1)
            .map(idx => arr.slice(idx, idx + by));
        // arr.slice(by).map((el, idx) => [ arr[idx - 1], ]);
    })
        .setName("each_cons")
        .setArity(2);

GlintInterpreter.STANDARD_LIBRARY.each_slice =
    new GlintFunction((arr, by) => {
        assert(by > 0, `Invalid slice size ${by}`);
        return Glint.range(Math.ceil(arr.length / by))
            .map(idx => arr.slice(idx * by, (idx + 1) * by));
    })
        .setName("each_slice")
        .setArity(2);

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
