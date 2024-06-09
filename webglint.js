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
        let myOffset = interpreter.variables.OUT.length;
        let tmpValue = null;
        
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
            if(ev.key === "ArrowUp" && input.selectionStart === 0 && input.selectionEnd === 0) {
                // if(input.selectionEnd === 0) {
                if(!input.value.slice(0, input.selectionStart).includes("\n")) {
                    if(tmpValue === null) {
                        tmpValue = input.value;
                    }
                    ev.preventDefault();
                    myOffset--;
                    if(myOffset < 0) {
                        myOffset = 0;
                    }
                    input.value = interpreter.variables.IN.at(myOffset);
                    input.selectionStart = 0;//input.value.length;
                    input.selectionEnd = 0;
                    fitTextToArea(input);
                }
            }
            if(ev.key === "ArrowDown") {
                // if(input.selectionEnd === input.value.length - 1) {
                if(!input.value.slice(input.selectionEnd).includes("\n")) {
                    ev.preventDefault();
                    myOffset++;
                    if(myOffset >= interpreter.variables.IN.length) {
                        myOffset = interpreter.variables.IN.length;
                        input.value = tmpValue;
                        tmpValue = null;
                    }
                    else {
                        input.value = interpreter.variables.IN.at(myOffset);
                    }
                    input.selectionStart = input.value.length;
                    fitTextToArea(input);
                }
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
