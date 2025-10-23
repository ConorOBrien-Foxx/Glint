const assert = require("assert");
const Glint = require("./../glint.js");
const {
    AssertionError,
    GlintInterpreter,
    GlintFunction,
    GlintShunting,
    GlintTokenizer,
} = Glint;
Glint.console.silent = true;
    
const anyChildHasKeyFrom = (object, keySet) => {
    if(Array.isArray(object)) {
        return object.some(child => anyChildHasKeyFrom(child, keySet));
    }
    return keySet.some(key => Object.hasOwn(object, key));
};

const subsetKeysFromObject = (keys, obj) =>
    Object.fromEntries(
        Object.entries(obj)
            .filter(([key, value]) => keys.includes(key))
            .map(([key, value]) => [key, anyChildHasKeyFrom(value, keys) ? subsetKeysFromObject(keys, value) : value])
    );

const assertByKey = (keys, testingValues, expectedValues) => {
    // assert.equal(testingValues.length, expectedValues.length, "Expected same number of entries on each side");
    
    let testingIsArray = Array.isArray(testingValues);
    let expectedIsArray = Array.isArray(expectedValues);
    
    assert(!(testingIsArray && !expectedIsArray), "Testing array against non-array");
    assert(!(!testingIsArray && expectedIsArray), "Testing non-array againt array");
    
    // now, keysIsArray and expectedIsArray are both true, or both false
    
    let testingImage = testingIsArray
        ? testingValues.map(value => subsetKeysFromObject(keys, value))
        : subsetKeysFromObject(keys, testingValues);
    let expectedImage = expectedIsArray
        ? expectedValues.map(value => subsetKeysFromObject(keys, value))
        : subsetKeysFromObject(keys, expectedValues);
    
    // console.log(testingImage, expectedImage);
    
    assert.deepEqual(testingImage, expectedImage);
    
    // XXX: changed: it used to subset the deep keys, now it does not
    /*
    
    tokens.forEach((token, idx) => {
        let expected = expectedValues[idx];
        
        for(let key of keys) {
            let left = token[key];
            let right = expected[key];

            if(left && right && [ left, right ].some(object =>
                anyChildHasKeyFrom(object, keys)
            )) {
                // recursively compare
                // console.log("RECURSING", keys, left, right);
                assertByKey(keys, left, right);
            }
            else {
                assert.equal(token[key], expected[key], `Keys \`${key}\` do not match (index@${idx})`);
            }
        }
    });
    */
};

const assertTokensEqual = (...args) =>
    assertByKey(["type", "value"], ...args);

const assertTokensEqualWithArity = (...args) =>
    assertByKey(["type", "value", "arity"], ...args);

const assertTokensEqualWithArityAndAdverbs = (...args) =>
    assertByKey(["type", "value", "arity", "adverbs"], ...args);

describe("testing", () => {
    describe("assertByKey", () => {
        it("should be vacuously true for empty key set", () => {
            assertByKey([], { a: 3 }, { a: 5 });
        });
        it("should be vacuously true for objects with no matching key", () => {
            assertByKey(["qwerty"], { a: 3 }, { a: 5 });
        });
        it("should be true for objects with the same matching key", () => {
            assertByKey(["a"], { a: 3, b: 10, c: 93 }, { a: 3, b: 15 });
            assertByKey(["a"], { a: 3, b: 15 }, { a: 3, b: 10, c: 93 });
        });
        it("should be false for objects differing by the matching key", () => {
            assert.throws(() => assertByKey(["a"], { a: 3, b: 10, c: 93 }, { a: 13, b: 15 }));
            assert.throws(() => assertByKey(["a"], { a: 13, b: 15 }, { a: 3, b: 10, c: 93 }));
        });
        it("should be false when only one object has the key", () => {
            assert.throws(() => assertByKey(["a"], { a: 3 }, { b: 3 }));
            assert.throws(() => assertByKey(["a"], { b: 3 }, { a: 3 }));
        });
        it("should be false when only one of the requested keys matches", () => {
            assert.throws(() => assertByKey(["a", "b"], { a: 3, b: 9234 }, { a: 3, b: 3 }));
        });
        it("should be true when all the requested keys matches", () => {
            assertByKey(["a", "b"], { a: 3, b: 3 }, { a: 3, b: 3 });
        });
        it("should work for deep keys", () => {
            assertByKey(["a"], { a: { a: 15, b: 10 }, b: 910 }, { a: { a: 15, b: 10 }, b: 99 });
        });
        it("should propogate selected key to deep objects", () => {
            assertByKey(["a"], { a: { a: 15, b: 10 }, b: 910 }, { a: { a: 15, b: -1000000 }, b: 99 });
        });
        it("should work for arrays of objects", () => {
            assertByKey(["a"],
                [ { a: 3 }, { a: 10, b: 1337 }, { noA: null } ],
                [ { a: 3 }, { a: 10, b: -591 }, { noA: null } ]
            );
            assert.throws(() => assertByKey(["a"],
                [ { a: 3 }, { a: 10, b: 1337 }, { noA: null } ],
                [ { a: 3 }, { a: -1, b: -591 }, { noA: null } ]
            ));
        })
    });
});

// TODO: test shunting (including what should fail/error)
describe("shunting", () => {
    let shunter;
    beforeEach(() => {
        shunter = null;
    });
    
    describe("automatic parenthesis insertion", () => {
        it("runs in the constructor", () => {
            const tokens = Glint.tokenize("f 5");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
            ]);
        });
        
        it("inserts parentheses around long expressions", () => {
            const tokens = Glint.tokenize("3+f 4*5");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "+", type: GlintTokenizer.Types.OPERATOR },
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
                { value: "*", type: GlintTokenizer.Types.OPERATOR },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
            ]);
        });
        
        it("works on multiple functions", () => {
            const tokens = Glint.tokenize("f g 2+h 3");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "g", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
                { value: "+", type: GlintTokenizer.Types.OPERATOR },
                { value: "h", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
            ]);
        });
        
        it("works with multiple arguments", () => {
            const tokens = Glint.tokenize("f 3;g 4;5");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: ";", type: GlintTokenizer.Types.SEPARATOR },
                { value: "g", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
                { value: ";", type: GlintTokenizer.Types.SEPARATOR },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
            ]);
        });
        
        it("works with nested expressions", () => {
            const tokens = Glint.tokenize("f 3;(4+5);6");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: ";", type: GlintTokenizer.Types.SEPARATOR },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
                { value: "+", type: GlintTokenizer.Types.OPERATOR },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
                { value: ";", type: GlintTokenizer.Types.SEPARATOR },
                { value: "6", type: GlintTokenizer.Types.NUMBER },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
            ]);
        });
        
        it("works within arrays", () => {
            const tokens = Glint.tokenize("[f[3;4];5]");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "[", type: GlintTokenizer.Types.OPEN_BRACKET },
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "[", type: GlintTokenizer.Types.OPEN_BRACKET },
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: ";", type: GlintTokenizer.Types.SEPARATOR },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
                { value: "]", type: GlintTokenizer.Types.CLOSE_BRACKET },
                { value: ";", type: GlintTokenizer.Types.SEPARATOR },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
                { value: "]", type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        
        it("works within lambdas", () => {
            const tokens = Glint.tokenize("{a:f a}");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "{}", type: GlintTokenizer.Types.LAMBDA },
                { value: "{", type: GlintTokenizer.Types.OPEN_BRACE },
                // the following are not contained within the main tokenized group
                // { value: "a", type: GlintTokenizer.Types.WORD },
                // { value: ":", type: GlintTokenizer.Types.OPERATOR },
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: " ", type: GlintTokenizer.Types.WHITESPACE },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
                { value: "}", type: GlintTokenizer.Types.CLOSE_BRACE },
            ]);
        });
        
        it("leaves valid expressions alone", () => {
            const tokens = Glint.tokenize("f(a)");
            shunter = new GlintShunting(tokens);
            
            assertTokensEqual(shunter.tokens, [
                { value: "f", type: GlintTokenizer.Types.WORD },
                { value: "(", type: GlintTokenizer.Types.OPEN_PAREN },
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: ")", type: GlintTokenizer.Types.CLOSE_PAREN },
            ]);
        });
    });
    
    describe("literals", () => {
        it("supports basic lists", () => {
            const tokens = Glint.tokenize("[1;2;3]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "]", arity: 3, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        
        it("supports singleton lists", () => {
            const tokens = Glint.tokenize("[ 5134 ]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "5134", type: GlintTokenizer.Types.NUMBER },
                { value: "]", arity: 1, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        
        it("supports empty lists", () => {
            const tokens = Glint.tokenize("[]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "]", arity: 0, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        
        it("errors for consecutive data", () => {
            const tokens = Glint.tokenize("34 23");
            shunter = new GlintShunting(tokens);
            assert.throws(() => {
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
    });
    
    describe("operators", () => {
        it("puts a simple expression in postfix notation", () => {
            const tokens = Glint.tokenize("93*2");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "93", type: GlintTokenizer.Types.NUMBER },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
                { value: "*", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("respects basic precedence", () => {
            const tokens = Glint.tokenize("314 + 159 * 265");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "314", type: GlintTokenizer.Types.NUMBER },
                { value: "159", type: GlintTokenizer.Types.NUMBER },
                { value: "265", type: GlintTokenizer.Types.NUMBER },
                { value: "*", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "+", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("respects parentheses", () => {
            const tokens = Glint.tokenize("(314 + 159) * 265");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "314", type: GlintTokenizer.Types.NUMBER },
                { value: "159", type: GlintTokenizer.Types.NUMBER },
                { value: "+", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "265", type: GlintTokenizer.Types.NUMBER },
                { value: "*", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("supports unary operators at start of expression", () => {
            const tokens = Glint.tokenize("/300");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "300", type: GlintTokenizer.Types.NUMBER },
                { value: "/", arity: 1, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("supports unary operators after parenthesis", () => {
            const tokens = Glint.tokenize("5*(+300)");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "300", type: GlintTokenizer.Types.NUMBER },
                { value: "+", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "*", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("parses unary operators first", () => {
            const tokens = Glint.tokenize("+3 * 5");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "+", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "*", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("supports unary operator after binary operator", () => {
            const tokens = Glint.tokenize("3+*5");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "*", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "+", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("supports chained unary operators", () => {
            const tokens = Glint.tokenize("-/+5");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "+", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "/", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "-", arity: 1, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("supports unary operators in list", () => {
            const tokens = Glint.tokenize("[ -1; *3+4; +/5 ]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "-", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "*", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
                { value: "+", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "/", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "+", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                
                { value: "]", arity: 3, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        
        it("errors with no second operand", () => {
            const tokens = Glint.tokenize("3 +");
            assert.throws(() => {
                shunter = new GlintShunting(tokens);
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
        
        it("errors when given postfix code", () => {
            const tokens = Glint.tokenize("3 4 +");
            assert.throws(() => {
                shunter = new GlintShunting(tokens);
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
        it("errors when given postfix code in parentheses", () => {
            const tokens = Glint.tokenize("(3;4)+");
            assert.throws(() => {
                shunter = new GlintShunting(tokens);
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
        it("errors when given postfix code in lambda", () => {
            const tokens = Glint.tokenize("{:3;4+}()");
            assert.throws(() => {
                shunter = new GlintShunting(tokens);
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
        
        it("supports `% of` with a space", () => {
            const tokens = Glint.tokenize("5% of 50");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "50", type: GlintTokenizer.Types.NUMBER },
                { value: "%of", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("interprets `.` in `a.b` as an operator", () => {
            const tokens = Glint.tokenize("a.b");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("correctly orders nested access `a.b.c`", () => {
            const tokens = Glint.tokenize("a.b.c");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "c", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("correctly orders nested function call `a.b(c)`", () => {
            const tokens = Glint.tokenize("a.b(c)");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            // console.log(output);
            assertTokensEqualWithArity(output, [
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "c", type: GlintTokenizer.Types.WORD },
                { value: "@", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("correctly orders nested function call `a.b.c(d)`", () => {
            const tokens = Glint.tokenize("a.b.c(d)");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            // console.log(output);
            assertTokensEqualWithArity(output, [
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "c", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "d", type: GlintTokenizer.Types.WORD },
                { value: "@", arity: 2, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("correctly binds unary operations less tightly than dot access", () => {
            const tokens = Glint.tokenize("-a.b");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            // console.log(output);
            assertTokensEqualWithArity(output, [
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "-", arity: 1, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        
        it("correctly binds unary operations less tightly than dot access call", () => {
            const tokens = Glint.tokenize("-a.b()");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            // console.log(output);
            assertTokensEqualWithArity(output, [
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "@", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "-", arity: 1, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
    });
    
    describe("adverbs", () => {
        it("modifies a verb", () => {
            const tokens = Glint.tokenize("123 .+ 14");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArityAndAdverbs(output, [
                { value: "123", type: GlintTokenizer.Types.NUMBER },
                { value: "14", type: GlintTokenizer.Types.NUMBER },
                { value: "+", arity: 2, type: GlintTokenizer.Types.OPERATOR, adverbs: [
                    { value: ".", type: GlintTokenizer.Types.ADVERB },
                ] },
            ]);
        });
        
        it("applies adverb to unary", () => {
            const tokens = Glint.tokenize(".- 1993");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArityAndAdverbs(output, [
                { value: "1993", type: GlintTokenizer.Types.NUMBER },
                { value: "-", arity: 1, type: GlintTokenizer.Types.OPERATOR, adverbs: [
                    { value: ".", type: GlintTokenizer.Types.ADVERB },
                ] },
            ]);
        });
        
        it("stacks multiple adverbs", () => {
            const tokens = Glint.tokenize("4 ..% 5");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArityAndAdverbs(output, [
                { value: "4", type: GlintTokenizer.Types.NUMBER },
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "%", arity: 2, type: GlintTokenizer.Types.OPERATOR, adverbs: [
                    { value: ".", type: GlintTokenizer.Types.ADVERB },
                    { value: ".", type: GlintTokenizer.Types.ADVERB },
                ] },
            ]);
        });
        
        it("stacks different adverbs on the same operator in the correct order", () => {
            const tokens = Glint.tokenize("&.* 1");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArityAndAdverbs(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "*", arity: 1, type: GlintTokenizer.Types.OPERATOR, adverbs: [
                    { value: ".", type: GlintTokenizer.Types.ADVERB },
                    { value: "&", type: GlintTokenizer.Types.ADVERB },
                ] },
            ]);
        });
        
        it("errors when adverb applied to a noun", () => {
            const tokens = Glint.tokenize("&1");
            assert.throws(() => {
                shunter = new GlintShunting(tokens);
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
        
        it("errors when adverb is alone", () => {
            const tokens = Glint.tokenize("&");
            assert.throws(() => {
                shunter = new GlintShunting(tokens);
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
        
        it("errors when adverb is not followed by verb", () => {
            const tokens = Glint.tokenize("3 + &");
            assert.throws(() => {
                shunter = new GlintShunting(tokens);
                const output = shunter.shuntingYard();
            }, AssertionError);
        });
    });

    describe("separators", () => {
        it("works with a linebreak between two pieces of data", () => {
            const tokens = Glint.tokenize("1\n2");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
            ]);
        });
        it("errors with a space between two pieces of data", () => {
            const tokens = Glint.tokenize("1 2");
            shunter = new GlintShunting(tokens);
            assert.throws(() => shunter.shuntingYard());
        });
        it("can have a linebreak in arrays after semicolon", () => {
            const tokens = Glint.tokenize("[1;\n2]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
                { value: "]", arity: 2, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        it("can have a linebreak in arrays before semicolon", () => {
            const tokens = Glint.tokenize("[1\n;2]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
                { value: "]", arity: 2, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        it("can have a linebreak in arrays after open bracket", () => {
            const tokens = Glint.tokenize("[\n1;2]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
                { value: "]", arity: 2, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        it("can have a linebreak in arrays before close bracket", () => {
            const tokens = Glint.tokenize("[1;2\n]");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "1", type: GlintTokenizer.Types.NUMBER },
                { value: "2", type: GlintTokenizer.Types.NUMBER },
                { value: "]", arity: 2, type: GlintTokenizer.Types.CLOSE_BRACKET },
            ]);
        });
        it("can exist in a bare context", () => {
            const tokens = Glint.tokenize("5;6");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                { value: "5", type: GlintTokenizer.Types.NUMBER },
                { value: "6", type: GlintTokenizer.Types.NUMBER },
            ]);
        });
        it("can have a separator in a lambda", () => {
            const tokens = Glint.tokenize("{:3;4}");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assert(Array.isArray(output[0]?.groups), "Expected to generate one lambda");
            let [ args, body ] = output[0].groups;
            assertTokensEqual(body, [
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
            ]);
        });
        it("can have a linebreak as a separator in a lambda", () => {
            const tokens = Glint.tokenize("{:3\n4}");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assert(Array.isArray(output[0]?.groups), "Expected to generate one lambda");
            let [ args, body ] = output[0].groups;
            assertTokensEqual(body, [
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
            ]);
        });
        it("can have a separator in a parenthesized expression", () => {
            const tokens = Glint.tokenize("(3;4)");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqual(output, [
                // idk what this should even be, actually. maybe there should be a "canary" preventing stack stuff from reaching further down than it should
                { value: "3", type: GlintTokenizer.Types.NUMBER },
                { value: "4", type: GlintTokenizer.Types.NUMBER },
            ]);
        });
        it("can evaluate chained expressions", () => {
            const tokens = Glint.tokenize("a.b().c()");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                // idk what this should even be, actually. maybe there should be a "canary" preventing stack stuff from reaching further down than it should
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "@", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "c", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "@", arity: 1, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        it("can evaluate chained expressions separated by newlines", () => {
            const tokens = Glint.tokenize("a\n.b()\n.c()");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                // idk what this should even be, actually. maybe there should be a "canary" preventing stack stuff from reaching further down than it should
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "@", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "c", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "@", arity: 1, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
        it("can evaluate chained expressions separated by newlines and spaces", () => {
            const tokens = Glint.tokenize("a\n     .b()\n\t.c()");
            shunter = new GlintShunting(tokens);
            const output = shunter.shuntingYard();
            assertTokensEqualWithArity(output, [
                // idk what this should even be, actually. maybe there should be a "canary" preventing stack stuff from reaching further down than it should
                { value: "a", type: GlintTokenizer.Types.WORD },
                { value: "b", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "@", arity: 1, type: GlintTokenizer.Types.OPERATOR },
                { value: "c", type: GlintTokenizer.Types.WORD },
                { value: ".", arity: 2, type: GlintTokenizer.Types.OPERATOR },
                { value: "@", arity: 1, type: GlintTokenizer.Types.OPERATOR },
            ]);
        });
    });
});

// TODO: test broadcast
// TODO: test parsing literals
// TODO: test condensing ops

describe("operators", () => {
    let interpreter;
    beforeEach(() => {
        interpreter = new GlintInterpreter();
    });
    
    describe("+", () => {
        it("adds integers", async () => {
            let sum = await interpreter.evalOp("+", [ 3, 5 ]);
            assert.equal(sum, 8);
        });
        it("adds bignums", async () => {
            let sum = await interpreter.evalOp("+", [ -25n, 5n ]);
            assert.equal(sum, -20n);
        });
        it("adds floats", async () => {
            let sum = await interpreter.evalOp("+", [ 1.2, 1.3 ]);
            assert.equal(sum, 2.5);
        });
        it("concatenates lists", async () => {
            let sum = await interpreter.evalOp("+", [ [ 1, 2, 3 ], [ 4, 5 ] ]);
            assert.deepEqual(sum, [ 1, 2, 3, 4, 5 ]);
        });
        it("concatenates strings", async () => {
            let sum = await interpreter.evalOp("+", [ "HOLY ", "WATER" ]);
            assert.equal(sum, "HOLY WATER");
        });
        it("concatenates objects left-to-right", async () => {
            let sum = await interpreter.evalOp("+", [ { a: 3, b: 5 }, { c: 10, b: 15 } ]);
            assert.deepEqual(sum, { a: 3, b: 15, c: 10 });
        });
        it("float + int = float", async () => {
            let sum = await interpreter.evalOp("+", [ 3.5, 2 ]);
            assert.equal(sum, 5.5);
        });
        it("bigint + float = float", async () => {
            let sum = await interpreter.evalOp("+", [ -15n, 5.2 ]);
            assert.equal(sum, -9.8);
        });
    });
    
    describe("-", () => {
        it("subtracts integers", async () => {
            let difference = await interpreter.evalOp("-", [10, 5]);
            assert.equal(difference, 5);
        });
        it("subtracts bignums", async () => {
            let difference = await interpreter.evalOp("-", [-25n, 5n]);
            assert.equal(difference, -30n);
        });
        it("subtracts floats", async () => {
            let difference = await interpreter.evalOp("-", [1.5, 0.5]);
            assert.equal(difference, 1);
        });
        it("negates a single input", async () => {
            let negated = await interpreter.evalOp("-", [5]);
            assert.equal(negated, -5);
            let negatedBignum = await interpreter.evalOp("-", [5n]);
            assert.equal(negated, -5n);
        });
    });
    
    describe("*", () => {
        it("multiplies integers", async () => {
            let product = await interpreter.evalOp("*", [3, 5]);
            assert.equal(product, 15);
        });
        it("multiplies bignums", async () => {
            let product = await interpreter.evalOp("*", [-25n, 5n]);
            assert.equal(product, -125n);
        });
        it("multiplies floats", async () => {
            let product = await interpreter.evalOp("*", [1.5, 2]);
            assert.equal(product, 3);
        });
    });
    
    describe("/", () => {
        it("divides integers", async () => {
            let quotient = await interpreter.evalOp("/", [10, 5]);
            assert.equal(quotient, 2);
        });
        it("divides bignums", async () => {
            let quotient = await interpreter.evalOp("/", [-25n, 5n]);
            assert.equal(quotient, -5n);
        });
        it("divides floats", async () => {
            let quotient = await interpreter.evalOp("/", [3.0, 2]);
            assert.equal(quotient, 1.5);
        });
        it("folds a raw function over a list", async () => {
            let listFold = await interpreter.evalOp("/", [[1, 2, 3, 4], (p, c) => p + c]);
            assert.equal(listFold, 10);
        });
        it("folds a glint function over a list", async () => {
            let fn = new GlintFunction((p, c) => p + c);
            let listFold = await interpreter.evalOp("/", [[1, 2, 3, 4], fn]);
            assert.equal(listFold, 10);
        });
    });
    
    describe("%", () => {
        it("finds modulus of integers", async () => {
            let modulus = await interpreter.evalOp("%", [10, 3]);
            assert.equal(modulus, 1);
        });
        it("finds modulus of bignums", async () => {
            let modulus = await interpreter.evalOp("%", [-25n, 5n]);
            assert.equal(modulus, 0n);
        });
    });
    
    describe("<", () => {
        it("compares integers less than", async () => {
            let result = await interpreter.evalOp("<", [3, 5]);
            assert.equal(result, true);
        });
        it("compares floats less than", async () => {
            let result = await interpreter.evalOp("<", [1.5, 2.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically less than", async () => {
            let result = await interpreter.evalOp("<", ["apple", "banana"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically less than", async () => {
            let result = await interpreter.evalOp("<", [[1, 2], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe("<=", () => {
        it("compares integers less than or equal to", async () => {
            let result = await interpreter.evalOp("<=", [3, 5]);
            assert.equal(result, true);
        });
        it("compares floats less than or equal to", async () => {
            let result = await interpreter.evalOp("<=", [1.5, 2.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically less than or equal to", async () => {
            let result = await interpreter.evalOp("<=", ["apple", "banana"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically less than or equal to", async () => {
            let result = await interpreter.evalOp("<=", [[1, 2], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe(">", () => {
        it("compares integers greater than", async () => {
            let result = await interpreter.evalOp(">", [5, 3]);
            assert.equal(result, true);
        });
        it("compares floats greater than", async () => {
            let result = await interpreter.evalOp(">", [2.5, 1.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically greater than", async () => {
            let result = await interpreter.evalOp(">", ["banana", "apple"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically greater than", async () => {
            let result = await interpreter.evalOp(">", [[1, 2, 3], [1, 2]]);
            assert.equal(result, true);
        });
    });
    
    describe(">=", () => {
        it("compares integers greater than or equal to", async () => {
            let result = await interpreter.evalOp(">=", [5, 3]);
            assert.equal(result, true);
        });
        it("compares floats greater than or equal to", async () => {
            let result = await interpreter.evalOp(">=", [2.5, 1.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically greater than or equal to", async () => {
            let result = await interpreter.evalOp(">=", ["banana", "apple"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically greater than or equal to", async () => {
            let result = await interpreter.evalOp(">=", [[1, 2, 3], [1, 2]]);
            assert.equal(result, true);
        });
    });
    
    describe("=", () => {
        it("compares integers for equality", async () => {
            let result = await interpreter.evalOp("=", [5, 5]);
            assert.equal(result, true);
        });
        it("compares floats for equality", async () => {
            let result = await interpreter.evalOp("=", [2.5, 2.5]);
            assert.equal(result, true);
        });
        it("compares strings for equality", async () => {
            let result = await interpreter.evalOp("=", ["apple", "apple"]);
            assert.equal(result, true);
        });
        it("compares lists for equality", async () => {
            let result = await interpreter.evalOp("=", [[1, 2, 3], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe("!=", () => {
        it("compares integers for inequality", async () => {
            let result = await interpreter.evalOp("!=", [5, 3]);
            assert.equal(result, true);
        });
        it("compares floats for inequality", async () => {
            let result = await interpreter.evalOp("!=", [2.5, 1.5]);
            assert.equal(result, true);
        });
        it("compares strings for inequality", async () => {
            let result = await interpreter.evalOp("!=", ["apple", "banana"]);
            assert.equal(result, true);
        });
        it("compares lists for inequality", async () => {
            let result = await interpreter.evalOp("!=", [[1, 2], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe("<=>", () => {
        it("compares integers using spaceship operator", async () => {
            let result = await interpreter.evalOp("<=>", [5, 3]);
            assert.equal(result, 1);
        });
        it("compares floats using spaceship operator", async () => {
            let result = await interpreter.evalOp("<=>", [1.5, 2.5]);
            assert.equal(result, -1);
        });
        it("compares strings using spaceship operator", async () => {
            let result = await interpreter.evalOp("<=>", ["apple", "banana"]);
            assert.equal(result, -1);
        });
        it("compares lists using lexicographical order", async () => {
            let result = await interpreter.evalOp("<=>", [[1, 2], [1, 2, 3]]);
            assert.equal(result, -1);
        });
    });
    
    describe("@", () => {
        it("accesses index of array", async () => {
            let result = await interpreter.evalOp("@", [[1, 2, 3], 1]);
            assert.equal(result, 2);
        });
        it("accesses slices of array", async () => {
            let result = await interpreter.evalOp("@", [[1, 2, 3, 4, 5], [2, 4]]);
            assert.deepEqual(result, [3, 4]);
        });
        it("accesses negative-relative slices of array", async () => {
            let result = await interpreter.evalOp("@", [[1, 2, 3, 4, 5], [0, -2]]);
            assert.deepEqual(result, [1, 2, 3]);
        });
        it("accesses slices of string", async () => {
            let result = await interpreter.evalOp("@", ["hello, world!", [5, 9]]);
            assert.equal(result, ", wo");
        });
        it("accesses nested index of array", async () => {
            let result = await interpreter.evalOp("@", [[[1, 2], [3, 4]], 1, 0]);
            assert.equal(result, 3);
        });
        it("accesses index of string", async () => {
            let result = await interpreter.evalOp("@", ["hello", 1]);
            assert.equal(result, "e");
        });
        it("accesses index of object", async () => {
            let result = await interpreter.evalOp("@", [{ a: 3, b: 5 }, "b"]);
            assert.equal(result, 5);
        });
    });
    
    describe(":", () => {
        it("creates singleton array", async () => {
            let result = await interpreter.evalOp(":", [1]);
            assert.deepEqual(result, [1]);
        });
        it("creates array from two elements", async () => {
            let result = await interpreter.evalOp(":", [1, 2]);
            assert.deepEqual(result, [1, 2]);
        });
        it("creates array from two array elements", async () => {
            let result = await interpreter.evalOp(":", [ [ 1, 3 ], [ 2 ] ]);
            assert.deepEqual(result, [ [ 1, 3 ], [ 2 ] ]);
        });
        it("creates array from single array argument", async () => {
            let result = await interpreter.evalOp(":", [[1, 2, 3]]);
            assert.deepEqual(result, [[1, 2, 3]]);
        });
    });
    
    describe("%of", () => {
        it("calculates percentage of two integers", async () => {
            let result = await interpreter.evalOp("%of", [50, 200]);
            assert.equal(result, 100);
        });
        it("calculates percentage of two floats", async () => {
            let result = await interpreter.evalOp("%of", [0.5, 200]);
            assert.equal(result, 1);
        });
    });
    
    describe("#", () => {
        it("returns length of array", async () => {
            let result = await interpreter.evalOp("#", [[1, 2, 3]]);
            assert.equal(result, 3);
        });
        it("returns length of string", async () => {
            let result = await interpreter.evalOp("#", ["hello"]);
            assert.equal(result, 5);
        });
        it("returns array filled with value", async () => {
            let result = await interpreter.evalOp("#", [3, 0]);
            assert.deepEqual(result, [0, 0, 0]);
        });
        it("returns array filled with value of specified length", async () => {
            let result = await interpreter.evalOp("#", [4, 5]);
            assert.deepEqual(result, [5, 5, 5, 5]);
        });
    });
    
    describe(":=", () => {
        it("assigns value to variable", async () => {
            let result = await interpreter.eval("x := 10");
            assert.equal(interpreter.variables["x"], 10);
            assert.equal(result, 10);
        });
        it("defines and assigns function to variable", async () => {
            let result = await interpreter.eval("square(x) := x * x");
            assert(Glint.isFunction(interpreter.variables["square"]));
            assert.equal(interpreter.variables["square"].name, "square");
            assert.equal(interpreter.variables["square"].arity, 1);
            // function returns expected values
            assert.equal(await interpreter.variables["square"].call(interpreter, 3), 9);
            assert.equal(result, interpreter.variables["square"]);
        });
        // /*
        // change this when we make more sane behavior, maybe
        it("throws error for nested assignment expression", async () => {
            assert.rejects(async () => {
                await interpreter.eval("x + y := 10");
            });
        });
        // */
    });

});
