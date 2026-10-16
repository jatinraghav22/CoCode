
import { useRef, useState } from "react";
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
    Terminal,
    Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./Compiler.css";

const LANGUAGES = {
    python: {
        label: "Python",
        editorLanguage: "python",
        file: "main.py",
        starterCode:
            'name = input("Enter your name: ")\n' +
            'print(f"Hello, {name}! Welcome to CoCode.")\n',
        starterInput: "Developer",
    },
    javascript: {
        label: "JavaScript",
        editorLanguage: "javascript",
        file: "main.js",
        starterCode:
            'const name = "Developer";\n' +
            'console.log(`Hello, ${name}! Welcome to CoCode.`);\n',
        starterInput: "",
    },
    cpp: {
        label: "C++",
        editorLanguage: "cpp",
        file: "main.cpp",
        starterCode:
            "#include <iostream>\n" +
            "#include <string>\n\n" +
            "int main() {\n" +
            '    const std::string name = "Developer";\n' +
            '    std::cout << "Hello, " << name\n' +
            '              << "! Welcome to CoCode!" << std::endl;\n' +
            "    return 0;\n" +
            "}\n",
        starterInput: "",
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
    runHandler.current = runCode;

    function handleEditorMount(editor, monaco) {
        defineEditorTheme(monaco);

        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
            () => runHandler.current?.()
        );
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
                    <button className="reset-code-button" type="button" onClick={resetCode}>
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
