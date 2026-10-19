
import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Clock3,
    Code2,
    FileCode2,
    LoaderCircle,
    Play,
    RotateCcw,
    Sparkles,
    Terminal,
    Trash2,
    Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./Compiler.css";

const SAMPLE_PROGRAMS = {
    python: {
        hello: {
            title: "Hello World",
            code: 'name = input("Enter your name: ") or "Developer"\nprint(f"Hello, {name}! Welcome to CoCode.")\n',
            stdin: "Developer",
        },
        factorial: {
            title: "Factorial",
            code: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nval = int(input("Enter number: ") or 6)\nprint(f"Factorial of {val} is: {factorial(val)}")\n',
            stdin: "6",
        },
        fibonacci: {
            title: "Fibonacci",
            code: 'def fibonacci(limit):\n    a, b = 0, 1\n    series = []\n    for _ in range(limit):\n        series.append(a)\n        a, b = b, a + b\n    return series\n\nprint("First 10 Fibonacci numbers:")\nprint(fibonacci(10))\n',
            stdin: "",
        },
        prime: {
            title: "Prime Check",
            code: 'def is_prime(num):\n    if num < 2:\n        return False\n    for i in range(2, int(num**0.5) + 1):\n        if num % i == 0:\n            return False\n    return True\n\ntest = int(input("Enter integer: ") or 29)\nprint(f"Is {test} prime? -> {is_prime(test)}")\n',
            stdin: "29",
        },
    },
    javascript: {
        hello: {
            title: "Hello World",
            code: 'const name = "Developer";\nconsole.log(`Hello, ${name}! Welcome to CoCode.`);\n',
            stdin: "",
        },
        factorial: {
            title: "Factorial",
            code: 'function factorial(n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nconst num = 6;\nconsole.log(`Factorial of ${num} is: ${factorial(num)}`);\n',
            stdin: "",
        },
        fibonacci: {
            title: "Fibonacci",
            code: 'function getFibonacci(count) {\n    const sequence = [0, 1];\n    for (let i = 2; i < count; i++) {\n        sequence.push(sequence[i - 1] + sequence[i - 2]);\n    }\n    return sequence.slice(0, count);\n}\n\nconsole.log("First 10 Fibonacci numbers:", getFibonacci(10));\n',
            stdin: "",
        },
        prime: {
            title: "Prime Check",
            code: 'function isPrime(val) {\n    if (val < 2) return false;\n    for (let i = 2; i <= Math.sqrt(val); i++) {\n        if (val % i === 0) return false;\n    }\n    return true;\n}\n\nconst testNum = 29;\nconsole.log(`Is ${testNum} prime? -> ${isPrime(testNum)}`);\n',
            stdin: "",
        },
    },
    cpp: {
        hello: {
            title: "Hello World",
            code: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World! Welcome to CoCode." << std::endl;\n    return 0;\n}\n',
            stdin: "",
        },
        factorial: {
            title: "Factorial",
            code: '#include <iostream>\n\nlong long factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nint main() {\n    int n = 6;\n    std::cout << "Factorial of " << n << " is: " << factorial(n) << std::endl;\n    return 0;\n}\n',
            stdin: "",
        },
        fibonacci: {
            title: "Fibonacci",
            code: '#include <iostream>\n#include <vector>\n\nint main() {\n    int n = 10;\n    std::vector<long long> fib = {0, 1};\n    for (int i = 2; i < n; ++i) {\n        fib.push_back(fib[i - 1] + fib[i - 2]);\n    }\n    std::cout << "Fibonacci sequence: ";\n    for (auto v : fib) std::cout << v << " ";\n    std::cout << std::endl;\n    return 0;\n}\n',
            stdin: "",
        },
        prime: {
            title: "Prime Check",
            code: '#include <iostream>\n#include <cmath>\n\nbool isPrime(int n) {\n    if (n < 2) return false;\n    for (int i = 2; i <= std::sqrt(n); ++i) {\n        if (n % i == 0) return false;\n    }\n    return true;\n}\n\nint main() {\n    int n = 29;\n    std::cout << "Is " << n << " prime? -> " << (isPrime(n) ? "Yes" : "No") << std::endl;\n    return 0;\n}\n',
            stdin: "",
        },
    },
};

const LANGUAGES = {
    python: {
        label: "Python",
        editorLanguage: "python",
        file: "main.py",
        starterCode: SAMPLE_PROGRAMS.python.hello.code,
        starterInput: SAMPLE_PROGRAMS.python.hello.stdin,
    },
    javascript: {
        label: "JavaScript",
        editorLanguage: "javascript",
        file: "main.js",
        starterCode: SAMPLE_PROGRAMS.javascript.hello.code,
        starterInput: SAMPLE_PROGRAMS.javascript.hello.stdin,
    },
    cpp: {
        label: "C++",
        editorLanguage: "cpp",
        file: "main.cpp",
        starterCode: SAMPLE_PROGRAMS.cpp.hello.code,
        starterInput: SAMPLE_PROGRAMS.cpp.hello.stdin,
    },
};

const API_BASE =
    (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

function defineEditorTheme(monaco) {
    monaco.editor.defineTheme("cocode-neon", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "comment", foreground: "7884A8", fontStyle: "italic" },
            { token: "keyword", foreground: "BD9AFF" },
            { token: "string", foreground: "87E8D0" },
            { token: "number", foreground: "F5BD83" },
            { token: "identifier", foreground: "DFE5FF" },
        ],
        colors: {
            "editor.background": "#0B0D18",
            "editor.foreground": "#E2E6FF",
            "editorLineNumber.foreground": "#4D5679",
            "editorLineNumber.activeForeground": "#B5A3FF",
            "editorCursor.foreground": "#78E7FF",
            "editor.lineHighlightBackground": "#17172A",
            "editor.selectionBackground": "#6246A766",
            "editor.inactiveSelectionBackground": "#6246A733",
            "editorIndentGuide.background1": "#242741",
            "editorIndentGuide.activeBackground1": "#65549B",
            "editorWidget.background": "#15172B",
            "focusBorder": "#8B76FF",
            "scrollbarSlider.background": "#656B8A44",
            "scrollbarSlider.hoverBackground": "#9182CD66",
            "scrollbarSlider.activeBackground": "#A38FFF88",
        },
    });
}

function Compiler() {
    const [language, setLanguage] = useState("python");
    const [codes, setCodes] = useState(() =>
        Object.fromEntries(
            Object.entries(LANGUAGES).map(([key, item]) => [key, item.starterCode])
        )
    );
    const [inputs, setInputs] = useState(() =>
        Object.fromEntries(
            Object.entries(LANGUAGES).map(([key, item]) => [key, item.starterInput])
        )
    );
    const [activePanel, setActivePanel] = useState("output");
    const [result, setResult] = useState(null);
    const [executionError, setExecutionError] = useState("");
    const [isRunning, setIsRunning] = useState(false);

    const activeLanguage = LANGUAGES[language];
    const code = codes[language];
    const stdin = inputs[language];
    const runHandler = useRef(null);

    async function runCode() {
        if (isRunning || !code.trim()) return;

        setIsRunning(true);
        setExecutionError("");
        setResult(null);
        setActivePanel("output");

        try {
            const response = await fetch(`${API_BASE}/api/compiler/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceCode: code,
                    language,
                    stdin,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || `Request failed (${response.status})`);
            }

            setResult(data);
        } catch (error) {
            setExecutionError(
                error.message ||
                "Cannot connect to the compiler. Check that the backend is running."
            );
        } finally {
            setIsRunning(false);
        }
    }

    // Keep the latest handler available to Monaco's keyboard shortcut.
    useEffect(() => {
        runHandler.current = runCode;
    });

    function handleEditorMount(editor, monaco) {
        defineEditorTheme(monaco);

        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
            () => runHandler.current?.()
        );
    }

    function loadSampleProgram(key) {
        const sample = SAMPLE_PROGRAMS[language]?.[key];
        if (sample) {
            setCodes((current) => ({
                ...current,
                [language]: sample.code,
            }));
            setInputs((current) => ({
                ...current,
                [language]: sample.stdin,
            }));
            setResult(null);
            setExecutionError("");
            setActivePanel("output");
        }
    }

    function clearCode() {
        setCodes((current) => ({
            ...current,
            [language]: "",
        }));
        setInputs((current) => ({
            ...current,
            [language]: "",
        }));
        setResult(null);
        setExecutionError("");
    }

    function resetCode() {
        setCodes((current) => ({
            ...current,
            [language]: activeLanguage.starterCode,
        }));
        setInputs((current) => ({
            ...current,
            [language]: activeLanguage.starterInput,
        }));
        setResult(null);
        setExecutionError("");
        setActivePanel("output");
    }

    function changeLanguage(nextLanguage) {
        setLanguage(nextLanguage);
        setResult(null);
        setExecutionError("");
    }

    const accepted =
        result?.status?.toLowerCase() === "accepted";

    return (
        <main className="compiler-page">
            <header className="compiler-topbar">
                <Link className="compiler-brand" to="/" aria-label="Back to CoCode home">
                    <span className="compiler-brand-mark">C</span>
                    <span>Co<span>Code</span></span>
                </Link>

                <div className="compiler-breadcrumb">
                    <span>Workspace</span>
                    <span className="breadcrumb-divider">/</span>
                    <strong>Online Compiler</strong>
                </div>

                <Link className="compiler-back-link" to="/">
                    <ArrowLeft size={15} />
                    <span>Home</span>
                </Link>
            </header>

            <section className="compiler-intro">
                <div>
                    <div className="compiler-eyebrow">
                        <span className="compiler-eyebrow-dot" />
                        PUBLIC CODING WORKSPACE
                        <span className="public-access-tag">NO LOGIN</span>
                    </div>

                    <h1>
                        Code. Run. <span>Repeat.</span>
                    </h1>

                    <p>
                        A focused space for your next idea. Write code, provide input,
                        and inspect the real execution result.
                    </p>
                </div>

                <div className="compiler-intro-note">
                    <Zap size={17} />
                    <span>
                        <strong>Ready when you are</strong>
                        <small>Use Ctrl + Enter to run code</small>
                    </span>
                </div>
            </section>

            <section className="compiler-workspace">
                <div className="compiler-editor-panel">
                    <div className="compiler-editor-toolbar">
                        <div className="compiler-file-tab">
                            <FileCode2 size={15} />
                            <span>{activeLanguage.file}</span>
                            <i />
                        </div>

                        <div className="compiler-toolbar-right">
                            <label className="language-select-wrap sample-select-wrap">
                                <Sparkles size={14} />
                                <select
                                    aria-label="Load sample program"
                                    defaultValue=""
                                    onChange={(event) => {
                                        if (event.target.value) {
                                            loadSampleProgram(event.target.value);
                                            event.target.value = "";
                                        }
                                    }}
                                >
                                    <option value="" disabled>Sample Programs...</option>
                                    <option value="hello">Hello World</option>
                                    <option value="factorial">Factorial</option>
                                    <option value="fibonacci">Fibonacci</option>
                                    <option value="prime">Prime Check</option>
                                </select>
                                <ChevronDown size={14} />
                            </label>

                            <label className="language-select-wrap">
                                <Code2 size={15} />
                                <select
                                    aria-label="Programming language"
                                    value={language}
                                    onChange={(event) => changeLanguage(event.target.value)}
                                >
                                    {Object.entries(LANGUAGES).map(([key, item]) => (
                                        <option key={key} value={key}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} />
                            </label>
                        </div>
                    </div>

                    <div className="compiler-editor-container">
                        <Editor
                            height="100%"
                            language={activeLanguage.editorLanguage}
                            value={code}
                            theme="cocode-neon"
                            beforeMount={defineEditorTheme}
                            onMount={handleEditorMount}
                            onChange={(value) =>
                                setCodes((current) => ({
                                    ...current,
                                    [language]: value ?? "",
                                }))
                            }
                            loading={
                                <div className="editor-loading">
                                    <LoaderCircle className="spin-icon" size={22} />
                                    Loading code editor...
                                </div>
                            }
                            options={{
                                automaticLayout: true,
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: "Consolas, 'Courier New', monospace",
                                fontLigatures: true,
                                lineNumbers: "on",
                                lineNumbersMinChars: 3,
                                padding: { top: 18, bottom: 18 },
                                scrollBeyondLastLine: false,
                                smoothScrolling: true,
                                cursorBlinking: "smooth",
                                renderLineHighlight: "all",
                                roundedSelection: true,
                                wordWrap: "on",
                                tabSize: 4,
                                overviewRulerLanes: 0,
                                scrollbar: {
                                    verticalScrollbarSize: 8,
                                    horizontalScrollbarSize: 8,
                                },
                            }}
                        />
                    </div>

                    <footer className="compiler-editor-footer">
                        <span><i className="footer-online-dot" /> Editor ready</span>
                        <span>{activeLanguage.label}</span>
                        <span>UTF-8</span>
                        <span>Spaces: 4</span>
                    </footer>
                </div>

                <aside className="compiler-console-panel">
                    <div className="console-titlebar">
                        <div className="console-title">
                            <Terminal size={16} />
                            <span>Console</span>
                        </div>
                        <span className="console-live-tag">
                            <i /> {isRunning ? "RUNNING" : result ? "FINISHED" : "READY"}
                        </span>
                    </div>

                    <div className="console-tabs" role="tablist" aria-label="Console panels">
                        <button
                            className={activePanel === "output" ? "active" : ""}
                            type="button"
                            role="tab"
                            aria-selected={activePanel === "output"}
                            onClick={() => setActivePanel("output")}
                        >
                            Output
                        </button>
                        <button
                            className={activePanel === "input" ? "active" : ""}
                            type="button"
                            role="tab"
                            aria-selected={activePanel === "input"}
                            onClick={() => setActivePanel("input")}
                        >
                            Input <span className="input-tab-dot" />
                        </button>
                        <button
                            className={activePanel === "problems" ? "active" : ""}
                            type="button"
                            role="tab"
                            aria-selected={activePanel === "problems"}
                            onClick={() => setActivePanel("problems")}
                        >
                            Problems
                        </button>
                    </div>

                    <div className="console-content" aria-live="polite">
                        {activePanel === "input" && (
                            <div className="input-panel">
                                <div className="console-section-label">
                                    <span>STDIN</span>
                                    <span>Program input</span>
                                </div>
                                <p className="input-help">
                                    Add the text your program should receive through standard input.
                                    Keep it empty if your program does not need input.
                                </p>
                                <textarea
                                    className="stdin-editor"
                                    value={stdin}
                                    onChange={(event) =>
                                        setInputs((current) => ({
                                            ...current,
                                            [language]: event.target.value,
                                        }))
                                    }
                                    placeholder="Type program input here..."
                                    spellCheck={false}
                                    aria-label="Standard input"
                                />
                                <p className="input-note">Input is sent only when you click Run.</p>
                            </div>
                        )}

                        {activePanel === "output" && (
                            <div className="output-panel">
                                {isRunning && (
                                    <div className="console-empty-state">
                                        <LoaderCircle className="spin-icon" size={26} />
                                        <strong>Running your code</strong>
                                        <span>Waiting for the execution service...</span>
                                    </div>
                                )}

                                {!isRunning && executionError && (
                                    <div className="console-message error-message">
                                        <AlertCircle size={17} />
                                        <div>
                                            <strong>Execution could not start</strong>
                                            <p>{executionError}</p>
                                        </div>
                                    </div>
                                )}

                                {!isRunning && !executionError && !result && (
                                    <div className="console-empty-state">
                                        <div className="console-empty-icon"><Terminal size={24} /></div>
                                        <strong>Your output will appear here</strong>
                                        <span>Press Run to execute your program.</span>
                                    </div>
                                )}

                                {!isRunning && result && (
                                    <div className="result-panel">
                                        <div className={`result-status ${accepted ? "success" : "failure"}`}>
                                            {accepted
                                                ? <CheckCircle2 size={16} />
                                                : <AlertCircle size={16} />}
                                            <strong>{result.status || "Execution finished"}</strong>
                                        </div>

                                        <div className="console-section-label output-label">
                                            <span>STDOUT</span>
                                            <span>Program output</span>
                                        </div>
                                        <pre className="result-text">
                                            {result.stdout || (accepted ? "Program finished with no output." : "No standard output.")}
                                        </pre>

                                        {(result.compileOutput || result.stderr || result.message) && (
                                            <div className="result-diagnostics">
                                                <div className="console-section-label">
                                                    <span>DIAGNOSTICS</span>
                                                </div>
                                                <pre className="result-text diagnostics-text">
                                                    {[result.compileOutput, result.stderr, result.message]
                                                        .filter(Boolean)
                                                        .join("\n\n")}
                                                </pre>
                                            </div>
                                        )}

                                        <div className="execution-metrics">
                                            <span><Clock3 size={13} /> {result.time ? `${result.time}s` : "Time n/a"}</span>
                                            <span>
                                                <Code2 size={13} />
                                                {result.memory != null
                                                    ? `${Math.round(Number(result.memory))} KB`
                                                    : "Memory n/a"}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activePanel === "problems" && (
                            <div className="problems-panel">
                                {executionError ? (
                                    <div className="console-message error-message">
                                        <AlertCircle size={17} />
                                        <div>
                                            <strong>Request error</strong>
                                            <p>{executionError}</p>
                                        </div>
                                    </div>
                                ) : result && (result.compileOutput || result.stderr || result.message) ? (
                                    <pre className="result-text diagnostics-text">
                                        {[result.compileOutput, result.stderr, result.message]
                                            .filter(Boolean)
                                            .join("\n\n")}
                                    </pre>
                                ) : (
                                    <div className="console-empty-state">
                                        <CheckCircle2 size={24} />
                                        <strong>No problems to show</strong>
                                        <span>Compiler diagnostics appear here after execution.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="console-bottom-bar">
                        <span><i className="footer-online-dot" /> Public workspace</span>
                        <span>Login not required</span>
                    </div>
                </aside>
            </section>

            <section className="compiler-actions">
                <div className="compiler-action-note">
                    <span className="action-note-icon"><Zap size={16} /></span>
                    <span>
                        <strong>Make something interesting.</strong>
                        <small>Code execution runs through an isolated execution service.</small>
                    </span>
                </div>

                <div className="compiler-buttons">
                    <button className="reset-code-button" type="button" onClick={clearCode} title="Clear code and terminal">
                        <Trash2 size={15} />
                        Clear
                    </button>
                    <button className="reset-code-button" type="button" onClick={resetCode} title="Reset starter code">
                        <RotateCcw size={15} />
                        Reset
                    </button>
                    <button
                        className="run-code-button"
                        type="button"
                        onClick={runCode}
                        disabled={isRunning || !code.trim()}
                    >
                        {isRunning
                            ? <LoaderCircle className="spin-icon" size={16} />
                            : <Play size={16} fill="currentColor" />}
                        {isRunning ? "Running..." : "Run code"}
                        {!isRunning && <span className="run-shortcut">Ctrl ↵</span>}
                    </button>
                </div>
            </section>

            <footer className="compiler-page-footer">
                <Link to="/" className="footer-home-link">CoCode</Link>
                <span>Built for curious minds.</span>
                <span>Public compiler · No account needed</span>
            </footer>
        </main>
    );
}

export default Compiler;
