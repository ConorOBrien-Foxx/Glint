window.addEventListener("load", function () {
    const fitTextToArea = (textarea, min=1) => {
        let lineCount = [...textarea.value].filter(ch => ch === "\n").length + 1;
        textarea.rows = Math.max(lineCount, min);
    };
    
    const code = document.getElementById("code");
    const input = document.getElementById("input");
    const output = document.getElementById("output");
    
    code.focus();
    
    const runCode = async (code, input) => {
        output.value = "";
        let interpreter = new GlintInterpreter();
        interpreter.loadStandardLibrary();
        let inputPointer = 0;
        interpreter.variables.input = () => {
            if(inputPointer >= input.length) {
                return null;
            }
            let nextLineIndex = input.indexOf("\n", inputPointer);
            if(nextLineIndex === -1) {
                let line = input.slice(inputPointer);
                inputPointer = input.length;
                return line;
            }
            else {
                let line = input.slice(inputPointer, nextLineIndex);
                inputPointer = nextLineIndex + 1;
                return line;
            }
        };
        interpreter.variables.ilines = () => {
            let result = input.slice(inputPointer).split("\n");
            inputPointer = input.length;
            return result;
        };
        interpreter.variables.read = () => {
            let result = input.slice(inputPointer);
            inputPointer = input.length;
            return result;
        };
        interpreter.variables.print = new GlintFunction((...args) => {
            let repr = args.map(e => e.toString());
            output.value += repr.join(" ");
            console.log(...repr);
        })
            .setName("print")
            .setArity(1);
        let result;
        try {
            result = await interpreter.eval(code);
        }
        catch(e) {
            console.error(e);
            result = e;
        }
        finally {
            if(output.value) {
                output.value += "\n---------------------\n";
            }
            output.value += Glint.display(result);
            fitTextToArea(output);
        }
    };
    
    output.value = "";
    
    for(let textarea of document.querySelectorAll("textarea")) {
        fitTextToArea(textarea);
        textarea.addEventListener("input", ev => {
            fitTextToArea(textarea);
        });
        textarea.addEventListener("keydown", ev => {
            if(ev.key === "Enter" && ev.ctrlKey) {
                runCode(code.value, input.value);
            }
        });
    }
});
