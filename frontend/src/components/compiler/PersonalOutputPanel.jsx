import { useState } from "react"
import { useRunCode } from "@/context/RunCodeContext"
import { usePersonalWorkspace } from "@/context/PersonalWorkspaceContext"
import { toast } from "react-hot-toast"
import {
    HiOutlinePlay,
    HiOutlineTrash,
    HiOutlineRefresh,
    HiOutlineClipboardCopy,
    HiOutlineTerminal,
    HiOutlineCode,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
} from "react-icons/hi"
import { PiCaretDownBold } from "react-icons/pi"
import { LuPlay } from "react-icons/lu"

const PersonalOutputPanel = ({ onRun, className = "" }) => {
    const {
        input,
        setInput,
        output,
        setOutput,
        isRunning,
        executionStatus,
        isErrorState,
        supportedLanguages,
        selectedLanguage,
        setSelectedLanguage,
        runHistory,
        rerunHistoryEntry,
        clearOutput,
    } = useRunCode()

    const { activeFile, resetCurrentFileCode } = usePersonalWorkspace()
    const [activeTab, setActiveTab] = useState("output") // "output" | "input" | "history"

    const handleCopy = () => {
        if (!output) return
        navigator.clipboard.writeText(output)
        toast.success("Output copied to clipboard")
    }

    const handleLanguageChange = (e) => {
        const langObj = JSON.parse(e.target.value)
        setSelectedLanguage(langObj)
    }

    return (
        <div className={`flex h-full flex-col bg-slate-950/85 border-l border-slate-800/70 ${className}`}>
            {/* Top Bar: Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/90 p-2.5">
                {/* Language Selector */}
                <div className="relative min-w-[150px] max-w-[220px] flex-1">
                    <select
                        className="w-full appearance-none rounded-xl border border-blue-500/30 bg-slate-900/90 py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(56,131,255,0.2)]"
                        value={JSON.stringify(selectedLanguage)}
                        onChange={handleLanguageChange}
                    >
                        {supportedLanguages.map((lang, idx) => (
                            <option key={idx} value={JSON.stringify(lang)}>
                                {lang.name || lang.language}
                            </option>
                        ))}
                    </select>
                    <PiCaretDownBold
                        size={12}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                </div>

                {/* Actions: Run Code, Clear, Reset */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetCurrentFileCode}
                        title="Reset code in active file to default starter"
                        className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                    >
                        <HiOutlineRefresh className="text-sm" />
                        <span className="hidden sm:inline">Reset</span>
                    </button>

                    <button
                        onClick={clearOutput}
                        title="Clear console output"
                        className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                    >
                        <HiOutlineTrash className="text-sm" />
                        <span className="hidden sm:inline">Clear</span>
                    </button>

                    <button
                        onClick={onRun}
                        disabled={isRunning || !activeFile}
                        className="btn-primary flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold shadow-[0_0_15px_rgba(46,168,255,0.3)] hover:shadow-[0_0_20px_rgba(46,168,255,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isRunning ? (
                            <>
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                <span>Running...</span>
                            </>
                        ) : (
                            <>
                                <HiOutlinePlay className="text-sm" />
                                <span>Run Code</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Navigation Tabs for Output / Input / History */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-3 bg-slate-950/60">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab("output")}
                        className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                            activeTab === "output"
                                ? "border-cyan-400 text-cyan-300"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <HiOutlineTerminal className="text-sm" />
                        Console Output
                        {isErrorState ? (
                            <span className="flex items-center gap-0.5 rounded-full bg-red-500/20 px-1.5 py-0.2 text-[10px] text-red-400 border border-red-500/30">
                                <HiOutlineExclamationCircle /> Error
                            </span>
                        ) : executionStatus === "Success" ? (
                            <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-400 border border-emerald-500/30">
                                <HiOutlineCheckCircle /> Success
                            </span>
                        ) : null}
                    </button>

                    <button
                        onClick={() => setActiveTab("input")}
                        className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                            activeTab === "input"
                                ? "border-cyan-400 text-cyan-300"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <HiOutlineCode className="text-sm" />
                        Input (stdin)
                        {input.trim() && (
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                            activeTab === "history"
                                ? "border-cyan-400 text-cyan-300"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <HiOutlineClock className="text-sm" />
                        History ({runHistory.length})
                    </button>
                </div>

                {activeTab === "output" && output && (
                    <button
                        onClick={handleCopy}
                        title="Copy Output"
                        className="flex items-center gap-1 rounded p-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                        <HiOutlineClipboardCopy />
                        <span className="text-[11px]">Copy</span>
                    </button>
                )}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-hidden p-3">
                {activeTab === "output" && (
                    <div className="flex h-full flex-col">
                        <div
                            className={`flex-1 overflow-y-auto rounded-xl border p-3 font-mono text-xs leading-relaxed transition ${
                                isErrorState
                                    ? "border-red-500/40 bg-red-950/20 text-red-300"
                                    : "border-slate-800 bg-slate-900/60 text-slate-100"
                            }`}
                        >
                            {output ? (
                                <pre className="whitespace-pre-wrap break-words">{output}</pre>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                                    <HiOutlineTerminal className="mb-2 h-8 w-8 text-slate-600" />
                                    <p className="text-xs">
                                        Click <strong className="text-cyan-400 font-semibold">▶ Run Code</strong> to execute your program
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-600">
                                        Output and compilation diagnostics will appear here
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "input" && (
                    <div className="flex h-full flex-col">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Provide standard input (stdin) for your program here..."
                            className="h-full w-full resize-none rounded-xl border border-slate-800 bg-slate-900/70 p-3 font-mono text-xs text-slate-100 outline-none transition focus:border-cyan-400"
                        />
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="flex h-full flex-col overflow-y-auto gap-2">
                        {runHistory.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                                <HiOutlineClock className="mb-2 h-8 w-8 text-slate-600" />
                                <p className="text-xs">No execution history yet</p>
                            </div>
                        ) : (
                            runHistory.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-200">
                                                {item.fileName}
                                            </span>
                                            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300 border border-blue-500/20">
                                                {item.language}
                                            </span>
                                            <span
                                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                                    item.status === "Success"
                                                        ? "bg-emerald-500/10 text-emerald-400"
                                                        : "bg-red-500/10 text-red-400"
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => rerunHistoryEntry(item.id)}
                                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                                        >
                                            <LuPlay className="text-[10px]" />
                                            Rerun
                                        </button>
                                    </div>

                                    <div className="max-h-20 overflow-hidden rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-400">
                                        <pre className="line-clamp-3 whitespace-pre-wrap">{item.output || "(no output)"}</pre>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default PersonalOutputPanel
