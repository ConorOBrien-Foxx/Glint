window.addEventListener("load", function () {
    const history = document.querySelector(".history");
    
    let lineIndex = 0;
    let interpreter = new GlintInterpreter();
    interpreter.loadStandardLibrary();
    interpreter.variables.IN = [];
    interpreter.variables.OUT = [];
    // TODO: wrap these functions
    interpreter.variables.clear = () => {
        lineIndex = -1;
        history.innerHTML = "";
    };
    interpreter.variables.input = () => new Promise((resolve, reject) => {
        acceptInput({ label: "...", evaluate: false }).then(resolve);
    });
    window.interpreter = interpreter;
    
    const fitTextToArea = textarea => {
        let lineCount = [...textarea.value].filter(ch => ch === "\n").length + 1;
        textarea.rows = lineCount;
    };
    
    const acceptInput = async ({
        label,
        history: historyLines,
        historyStart,
        append=true,
        evaluate=true
    }) => new Promise((resolve, reject) => {
        let myOffset = historyStart;
        
        let line = document.createElement("div");
        line.className = "line";
        
        let labelEl = document.createElement("div");
        labelEl.className = "label";
        labelEl.textContent = label;
        let input = document.createElement("textarea");
        input.rows = 1;
        
        let inputInProgress = null;
        
        input.addEventListener("keydown", async ev => {
            if(ev.key === "Enter" && !ev.shiftKey) {
                // submit
                ev.preventDefault();
                input.readOnly = true;
                if(historyLines) {
                    historyLines[lineIndex] = input.value;
                }
                if(evaluate) {
                    let result;
                    try {
                        result = await interpreter.eval(input.value);
                    }
                    catch(e) {
                        console.error(e);
                        result = e;
                    }
                    finally {
                        resolve(result);
                    }
                }
                else {
                    resolve(input.value);
                }
            }
            if(ev.key === "ArrowUp" && historyLines) {
                if(input.selectionStart === 0 && input.selectionEnd === 0) {
                // if(!input.value.slice(0, input.selectionStart).includes("\n")) {
                    if(inputInProgress === null) {
                        inputInProgress = input.value;
                    }
                    ev.preventDefault();
                    myOffset--;
                    if(myOffset < 0) {
                        myOffset = 0;
                    }
                    input.value = historyLines.at(myOffset);
                    input.selectionStart = 0;//input.value.length;
                    input.selectionEnd = 0;
                    fitTextToArea(input);
                }
            }
            if(ev.key === "ArrowDown" && historyLines) {
                // if(input.selectionEnd === input.value.length - 1) {
                if(!input.value.slice(input.selectionEnd).includes("\n")) {
                    ev.preventDefault();
                    myOffset++;
                    if(myOffset >= historyLines.length) {
                        myOffset = historyLines.length;
                        input.value = inputInProgress;
                        inputInProgress = null;
                    }
                    else {
                        input.value = historyLines.at(myOffset);
                    }
                    input.selectionStart = input.value.length;
                    fitTextToArea(input);
                }
            }
        });
        input.addEventListener("input", ev => {
            fitTextToArea(input);
        });
        
        line.appendChild(labelEl);
        line.appendChild(input);
        if(append) {
            history.appendChild(line);
            input.focus();
        }
    });
    
    const addInputLine = () => {
        let myOffset = interpreter.variables.OUT.length;
        acceptInput({
            label: `IN(${lineIndex}) := `,
            history: interpreter.variables.IN,
            historyStart: myOffset,
        })
        .then(result => {
            addOutputLine(result);
            lineIndex++;
            addInputLine();
        });
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
