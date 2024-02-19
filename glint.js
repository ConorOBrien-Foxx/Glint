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

Glint.display = (value, ancestors = []) => {
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
        let nextAncestors = [...ancestors, value];
        return "[ "
            + value
                .map(el => Glint.display(el, nextAncestors))
                .join("; ")
            + " ]";
    }
    if(typeof value === "object") {
        let nextAncestors = [...ancestors, value];
        return "{ "
            + Object.entries(value)
                .map(([key, el]) => Glint.display(key, nextAncestors) + ": " + Glint.display(el, nextAncestors))
                .join("; ")
            + " }";
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
    if(typeof value === "number") {
        let stringRep = value.toFixed(6);
        let [ iPart, fPart ] = stringRep.split(".");
        fPart = fPart.replace(/0+$/, "");
        fPart = fPart ? "." + fPart : "";
        return iPart + fPart;
    }
    // todo: better
    return "" + value;
};

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
        NUMBER: Symbol("GlintTokenizer.Types.NUMBER"),
        WORD: Symbol("GlintTokenizer.Types.WORD"),
        WHITESPACE: Symbol("GlintTokenizer.Types.WHITESPACE"),
        OPEN_PAREN: Symbol("GlintTokenizer.Types.OPEN_PAREN"),
        CLOSE_PAREN: Symbol("GlintTokenizer.Types.CLOSE_PAREN"),
        OPEN_BRACKET: Symbol("GlintTokenizer.Types.OPEN_BRACKET"),
        CLOSE_BRACKET: Symbol("GlintTokenizer.Types.CLOSE_BRACKET"),
        SEPARATOR: Symbol("GlintTokenizer.Types.SEPARATOR"),
        OP_CAPTURE: Symbol("GlintTokenizer.Types.OP_CAPTURE"),
        STRING: Symbol("GlintTokenizer.Types.STRING"),
    };
    // TODO: accept custom operators
    // final operator names have all whitespace removed
    static Regexes = [
        [ /(-?[\d,.]+)(deg)?/, GlintTokenizer.Types.NUMBER ],
        [ /%\s*of|[:<>!]=|[-+\/%*^=<>!@]/, GlintTokenizer.Types.OPERATOR ],
        [ /\w+/, GlintTokenizer.Types.WORD ],
        [ /[ \t]+/, GlintTokenizer.Types.WHITESPACE ],
        [ /;/, GlintTokenizer.Types.SEPARATOR ],
        [ /\(/, GlintTokenizer.Types.OPEN_PAREN ],
        [ /\)/, GlintTokenizer.Types.CLOSE_PAREN ],
        [ /\[/, GlintTokenizer.Types.OPEN_BRACKET ],
        [ /\]/, GlintTokenizer.Types.CLOSE_BRACKET ],
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
    static Precedence = {
        "+":    { precedence: 10,   associativity: "left" },
        "-":    { precedence: 10,   associativity: "left" },
        "*":    { precedence: 20,   associativity: "left" },
        "/":    { precedence: 20,   associativity: "left" },
        "%of":  { precedence: 20,   associativity: "left" },
        "%":    { precedence: 20,   associativity: "left" },
        "^":    { precedence: 30,   associativity: "right" },
        "(":    { precedence: -10,  associativity: "left" },
        "[":    { precedence: -10,  associativity: "left" },
        ":=":   { precedence: 0,    associativity: "right" },
        "=":    { precedence: 5,    associativity: "left" },
        "<=":   { precedence: 5,    associativity: "left" },
        "<":    { precedence: 5,    associativity: "left" },
        ">=":   { precedence: 5,    associativity: "left" },
        ">":    { precedence: 5,    associativity: "left" },
        "!=":   { precedence: 5,    associativity: "left" },
    }
    
    constructor(tokens) {
        this.tokens = tokens;
        this.outputQueue = [];
        this.operatorStack = [];
        // for tracking number of function parameters
        this.arityStack = [];
        // operators at the start of an expression are unary
        this.nextOpArity = 1;
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
                
                if(!nextToken || !this.isData(nextToken)) {
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
    
    comparePrecedence(token, stackToken) {
        let tokenInfo = GlintShunting.Precedence[token.value];
        let stackTokenInfo = GlintShunting.Precedence[stackToken.value];
        
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
            console.log("HELLO", this.operatorStack);
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
            range: (...args) =>
                args.length === 1
                    ? [...Array(args[0]).keys()]
                    : args.length === 2
                        ? [...Array(args[1] - args[0]).keys()].map(i => i + args[0])
                        : assert(args.length === 3, `Cannot handle ${args.length}-arity range`)
                        && [...Array(Math.ceil((args[1] - args[0]) / args[2])).keys()].map(i => i * args[2] + args[0]),
        });
        let mathWords = [
            "sin", "cos", "tan", "sinh", "cosh", "tanh"
        ];
        for(let word of mathWords) {
            this.variables[word] = Math[word];
        }
    }
    
    assertArity(instruction, expectedArity) {
        assert(
            instruction.arity === expectedArity,
            `Could not call arity-${expectedArity} operator ${instruction.value} as arity-${instruction.arity}`
        );
    }
    
    evalOp(instruction, args) {
        let { value, arity } = instruction;
        
        if(value === ":=") {
            let [ varName, value ] = args;
            value = this.evalTree(value);
            assert(varName.children === null, "Cannot handle nested assignment expression");
            this.variables[varName.value.value] = value;
            return value;
        }
        
        if(value === "%of") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x * y / 100;
        }
        
        if(value === "+") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x + y;
        }
        
        if(value === "-") {
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return arity === 1 ? -x : x - y;
        }
        
        if(value === "*") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x * y;
        }
        
        if(value === "/") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x / y;
        }
        
        if(value === "%") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x % y;
        }
        
        if(value === "^") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x ** y;
        }
        
        // TODO: compare arrays
        if(value === ">") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x > y;
        }
        
        if(value === "<") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x < y;
        }
        
        if(value === ">=") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x >= y;
        }
        
        if(value === "<=") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x <= y;
        }
        
        if(value === "=") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x == y;
        }
        
        if(value === "!=") {
            this.assertArity(instruction, 2);
            let [ x, y ] = args.map(arg => this.evalTree(arg));
            return x != y;
        }
        
        if(value === "@") {
            let [ base, ...indices ] = args.map(arg => this.evalTree(arg));
            return Glint.accessIndex(base, indices);
        }
        
        assert(false, `Could not handle instruction ${value}@${arity} (token ${Glint.display(instruction)})`);
    }
    
    makeTree(string) {
        let tokenizer = new GlintTokenizer(string);
        let tokens = tokenizer.getTokens();
        let shunter = new GlintShunting(tokens);
        let rpn = shunter.shuntingYard();
        let treeStack = [];
        for(let instruction of rpn) {
            if(instruction.arity === undefined) {
                treeStack.push({ value: instruction, children: null });
            }
            else {
                treeStack.push({
                    value: instruction,
                    children: treeStack.splice(-instruction.arity),
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
        number = parseFloat(number.replace(/,/g, ""));
        if(suffix === "deg") {
            number = number * Math.PI / 180;
        }
        else {
            assert(!suffix, "Cannot handle numeric suffix: " + suffix);
        }
        return number;
    }
    
    parseRawString(token) {
        let string = token.value;
        return string.slice(1, -1).replace(/\\(\\|\w+)/g,
            (whole, word) => word === "\\" ? "\\" : symbolFromName(word) ?? whole);
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
            return this.evalOp(instruction, children);
        }
        if(instruction.type === GlintTokenizer.Types.CLOSE_BRACKET) {
            // array
            return children.map(child => this.evalTree(child));
        }
        if(instruction.type === GlintTokenizer.Types.WORD) {
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
            assert(instruction.groups.length === 1, "Cannot capture more than 1 op yet");
            let myOp = instruction.groups[0];
            let fn = (...args) => this.evalOp({ ...myOp, arity: args.length }, args);
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
