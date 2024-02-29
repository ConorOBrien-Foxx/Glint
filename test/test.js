const assert = require("assert");
const Glint = require("./../glint.js");
const {
    GlintInterpreter,
    GlintFunction,
    GlintShunting,
    GlintTokenizer,
} = Glint;

// TODO: test broadcast
// TODO: test parsing literals
// TODO: test condensing ops
// TODO: test shunting (including what should fail/error)
// TODO: better error reporting

describe("operators", () => {
    let interpreter;
    beforeEach(() => {
        interpreter = new GlintInterpreter();
    });
    
    describe("+", () => {
        it("adds integers", () => {
            let sum = interpreter.evalOp("+", [ 3, 5 ]);
            assert.equal(sum, 8);
        });
        it("adds bignums", () => {
            let sum = interpreter.evalOp("+", [ -25n, 5n ]);
            assert.equal(sum, -20n);
        });
        it("adds floats", () => {
            let sum = interpreter.evalOp("+", [ 1.2, 1.3 ]);
            assert.equal(sum, 2.5);
        });
        it("concatenates lists", () => {
            let sum = interpreter.evalOp("+", [ [ 1, 2, 3 ], [ 4, 5 ] ]);
            assert.deepEqual(sum, [ 1, 2, 3, 4, 5 ]);
        });
        it("concatenates strings", () => {
            let sum = interpreter.evalOp("+", [ "HOLY ", "WATER" ]);
            assert.equal(sum, "HOLY WATER");
        });
        it("concatenates objects left-to-right", () => {
            let sum = interpreter.evalOp("+", [ { a: 3, b: 5 }, { c: 10, b: 15 } ]);
            assert.deepEqual(sum, { a: 3, b: 15, c: 10 });
        });
        it("float + int = float", () => {
            let sum = interpreter.evalOp("+", [ 3.5, 2 ]);
            assert.equal(sum, 5.5);
        });
        it("bigint + float = float", () => {
            let sum = interpreter.evalOp("+", [ -15n, 5.2 ]);
            assert.equal(sum, -9.8);
        });
    });
    
    describe("-", () => {
        it("subtracts integers", () => {
            let difference = interpreter.evalOp("-", [10, 5]);
            assert.equal(difference, 5);
        });
        it("subtracts bignums", () => {
            let difference = interpreter.evalOp("-", [-25n, 5n]);
            assert.equal(difference, -30n);
        });
        it("subtracts floats", () => {
            let difference = interpreter.evalOp("-", [1.5, 0.5]);
            assert.equal(difference, 1);
        });
        it("negates a single input", () => {
            let negated = interpreter.evalOp("-", [5]);
            assert.equal(negated, -5);
            let negatedBignum = interpreter.evalOp("-", [5n]);
            assert.equal(negated, -5n);
        });
    });
    
    describe("*", () => {
        it("multiplies integers", () => {
            let product = interpreter.evalOp("*", [3, 5]);
            assert.equal(product, 15);
        });
        it("multiplies bignums", () => {
            let product = interpreter.evalOp("*", [-25n, 5n]);
            assert.equal(product, -125n);
        });
        it("multiplies floats", () => {
            let product = interpreter.evalOp("*", [1.5, 2]);
            assert.equal(product, 3);
        });
    });
    
    describe("/", () => {
        it("divides integers", () => {
            let quotient = interpreter.evalOp("/", [10, 5]);
            assert.equal(quotient, 2);
        });
        it("divides bignums", () => {
            let quotient = interpreter.evalOp("/", [-25n, 5n]);
            assert.equal(quotient, -5n);
        });
        it("divides floats", () => {
            let quotient = interpreter.evalOp("/", [3.0, 2]);
            assert.equal(quotient, 1.5);
        });
        it("folds a raw function over a list", () => {
            let listFold = interpreter.evalOp("/", [[1, 2, 3, 4], (p, c) => p + c]);
            assert.equal(listFold, 10);
        });
        it("folds a glint function over a list", () => {
            let fn = new GlintFunction((p, c) => p + c);
            let listFold = interpreter.evalOp("/", [[1, 2, 3, 4], fn]);
            assert.equal(listFold, 10);
        });
    });
    
    describe("%", () => {
        it("finds modulus of integers", () => {
            let modulus = interpreter.evalOp("%", [10, 3]);
            assert.equal(modulus, 1);
        });
        it("finds modulus of bignums", () => {
            let modulus = interpreter.evalOp("%", [-25n, 5n]);
            assert.equal(modulus, 0n);
        });
    });
    
    describe("<", () => {
        it("compares integers less than", () => {
            let result = interpreter.evalOp("<", [3, 5]);
            assert.equal(result, true);
        });
        it("compares floats less than", () => {
            let result = interpreter.evalOp("<", [1.5, 2.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically less than", () => {
            let result = interpreter.evalOp("<", ["apple", "banana"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically less than", () => {
            let result = interpreter.evalOp("<", [[1, 2], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe("<=", () => {
        it("compares integers less than or equal to", () => {
            let result = interpreter.evalOp("<=", [3, 5]);
            assert.equal(result, true);
        });
        it("compares floats less than or equal to", () => {
            let result = interpreter.evalOp("<=", [1.5, 2.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically less than or equal to", () => {
            let result = interpreter.evalOp("<=", ["apple", "banana"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically less than or equal to", () => {
            let result = interpreter.evalOp("<=", [[1, 2], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe(">", () => {
        it("compares integers greater than", () => {
            let result = interpreter.evalOp(">", [5, 3]);
            assert.equal(result, true);
        });
        it("compares floats greater than", () => {
            let result = interpreter.evalOp(">", [2.5, 1.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically greater than", () => {
            let result = interpreter.evalOp(">", ["banana", "apple"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically greater than", () => {
            let result = interpreter.evalOp(">", [[1, 2, 3], [1, 2]]);
            assert.equal(result, true);
        });
    });
    
    describe(">=", () => {
        it("compares integers greater than or equal to", () => {
            let result = interpreter.evalOp(">=", [5, 3]);
            assert.equal(result, true);
        });
        it("compares floats greater than or equal to", () => {
            let result = interpreter.evalOp(">=", [2.5, 1.5]);
            assert.equal(result, true);
        });
        it("compares strings lexicographically greater than or equal to", () => {
            let result = interpreter.evalOp(">=", ["banana", "apple"]);
            assert.equal(result, true);
        });
        it("compares lists lexicographically greater than or equal to", () => {
            let result = interpreter.evalOp(">=", [[1, 2, 3], [1, 2]]);
            assert.equal(result, true);
        });
    });
    
    describe("=", () => {
        it("compares integers for equality", () => {
            let result = interpreter.evalOp("=", [5, 5]);
            assert.equal(result, true);
        });
        it("compares floats for equality", () => {
            let result = interpreter.evalOp("=", [2.5, 2.5]);
            assert.equal(result, true);
        });
        it("compares strings for equality", () => {
            let result = interpreter.evalOp("=", ["apple", "apple"]);
            assert.equal(result, true);
        });
        it("compares lists for equality", () => {
            let result = interpreter.evalOp("=", [[1, 2, 3], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe("!=", () => {
        it("compares integers for inequality", () => {
            let result = interpreter.evalOp("!=", [5, 3]);
            assert.equal(result, true);
        });
        it("compares floats for inequality", () => {
            let result = interpreter.evalOp("!=", [2.5, 1.5]);
            assert.equal(result, true);
        });
        it("compares strings for inequality", () => {
            let result = interpreter.evalOp("!=", ["apple", "banana"]);
            assert.equal(result, true);
        });
        it("compares lists for inequality", () => {
            let result = interpreter.evalOp("!=", [[1, 2], [1, 2, 3]]);
            assert.equal(result, true);
        });
    });
    
    describe("<=>", () => {
        it("compares integers using spaceship operator", () => {
            let result = interpreter.evalOp("<=>", [5, 3]);
            assert.equal(result, 1);
        });
        it("compares floats using spaceship operator", () => {
            let result = interpreter.evalOp("<=>", [1.5, 2.5]);
            assert.equal(result, -1);
        });
        it("compares strings using spaceship operator", () => {
            let result = interpreter.evalOp("<=>", ["apple", "banana"]);
            assert.equal(result, -1);
        });
        it("compares lists using lexicographical order", () => {
            let result = interpreter.evalOp("<=>", [[1, 2], [1, 2, 3]]);
            assert.equal(result, -1);
        });
    });
    
    describe("@", () => {
        it("accesses index of array", () => {
            let result = interpreter.evalOp("@", [[1, 2, 3], 1]);
            assert.equal(result, 2);
        });
        it("accesses nested index of array", () => {
            let result = interpreter.evalOp("@", [[[1, 2], [3, 4]], 1, 0]);
            assert.equal(result, 3);
        });
        it("accesses index of string", () => {
            let result = interpreter.evalOp("@", ["hello", 1]);
            assert.equal(result, "e");
        });
    });
    
    describe(":", () => {
        it("creates singleton array", () => {
            let result = interpreter.evalOp(":", [1]);
            assert.deepEqual(result, [1]);
        });
        it("creates array from two elements", () => {
            let result = interpreter.evalOp(":", [1, 2]);
            assert.deepEqual(result, [1, 2]);
        });
        it("creates array from two array elements", () => {
            let result = interpreter.evalOp(":", [ [ 1, 3 ], [ 2 ] ]);
            assert.deepEqual(result, [ [ 1, 3 ], [ 2 ] ]);
        });
        it("creates array from single array argument", () => {
            let result = interpreter.evalOp(":", [[1, 2, 3]]);
            assert.deepEqual(result, [[1, 2, 3]]);
        });
    });
    
    describe("%of", () => {
        it("calculates percentage of two integers", () => {
            let result = interpreter.evalOp("%of", [50, 200]);
            assert.equal(result, 100);
        });
        it("calculates percentage of two floats", () => {
            let result = interpreter.evalOp("%of", [0.5, 200]);
            assert.equal(result, 1);
        });
    });
    
    describe("#", () => {
        it("returns length of array", () => {
            let result = interpreter.evalOp("#", [[1, 2, 3]]);
            assert.equal(result, 3);
        });
        it("returns length of string", () => {
            let result = interpreter.evalOp("#", ["hello"]);
            assert.equal(result, 5);
        });
        it("returns array filled with value", () => {
            let result = interpreter.evalOp("#", [3, 0]);
            assert.deepEqual(result, [0, 0, 0]);
        });
        it("returns array filled with value of specified length", () => {
            let result = interpreter.evalOp("#", [4, 5]);
            assert.deepEqual(result, [5, 5, 5, 5]);
        });
    });
    
    describe(":=", () => {
        it("assigns value to variable", () => {
            let result = interpreter.evalOp(":=", [
                interpreter.makeTree("x"),
                interpreter.makeTree("10"),
            ]);
            assert.equal(interpreter.variables["x"], 10);
            assert.equal(result, 10);
        });
        it("defines and assigns function to variable", () => {
            let result = interpreter.evalOp(":=", [
                interpreter.makeTree("square(x)"),
                interpreter.makeTree("x * x"),
            ]);
            assert(Glint.isFunction(interpreter.variables["square"]));
            assert.equal(interpreter.variables["square"].name, "square");
            assert.equal(interpreter.variables["square"].arity, 1);
            // function returns expected values
            assert.equal(interpreter.variables["square"].call(null, 3), 9);
            assert.equal(result, interpreter.variables["square"]);
        });
        // /*
        // change this when we make more sane behavior, maybe
        it("throws error for nested assignment expression", () => {
            assert.throws(() => {
                interpreter.evalOp(":=", [
                    interpreter.makeTree("x + y"),
                    interpreter.makeTree("10"),
                ]);
            }, /Cannot handle nested assignment expression/);
        });
        // */
    });

});
