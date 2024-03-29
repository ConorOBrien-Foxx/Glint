window.addEventListener("load", function () {
    const history = document.querySelector(".history");
    
    let lineIndex = 0;
    let interpreter = new GlintInterpreter();
    interpreter.loadStandardLibrary();
    interpreter.variables.IN = [];
    interpreter.variables.OUT = [];
    interpreter.variables.clear = () => {
        lineIndex = -1;
        history.innerHTML = "";
    };
    window.interpreter = interpreter;
    
    const fitTextToArea = textarea => {
        let lineCount = [...textarea.value].filter(ch => ch === "\n").length + 1;
        textarea.rows = lineCount;
    };
    
    const addInputLine = () => {
        let label = document.createElement("div");
        label.className = "label";
        label.textContent = `IN(${lineIndex}) := `;
        let input = document.createElement("textarea");
        input.rows = 1;
        let line = document.createElement("div");
        line.className = "line";
        
        input.addEventListener("keydown", ev => {
            if(ev.key === "Enter" && !ev.shiftKey) {
                // submit
                ev.preventDefault();
                input.readOnly = true;
                interpreter.variables.IN[lineIndex] = input.value;
                let result;
                try {
                    result = interpreter.eval(input.value);
                }
                catch(e) {
                    console.error(e);
                    result = e;
                }
                finally {
                    addOutputLine(result);
                }
                
                lineIndex++;
                addInputLine();
            }
        });
        input.addEventListener("input", ev => {
            fitTextToArea(input);
        });
        
        line.appendChild(label);
        line.appendChild(input);
        history.appendChild(line);
        input.focus();
    };
    const addOutputLine = result => {
        if(result === undefined) {
            return;
        }
        let label = document.createElement("div");
        label.className = "label";
        label.textContent = `OUT(${lineIndex}) := `;
        let output = document.createElement("textarea");
        output.readOnly = true;
        output.value = Glint.display(result);
        fitTextToArea(output);
        interpreter.variables.OUT[lineIndex] = result;
        let line = document.createElement("div");
        line.className = "line";
        
        line.appendChild(label);
        line.appendChild(output);
        history.appendChild(line);
        
    };
    addInputLine();
});
