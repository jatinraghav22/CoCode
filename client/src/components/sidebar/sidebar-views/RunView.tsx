import { useRunCode } from "@/context/RunCodeContext"
import useResponsive from "@/hooks/useResponsive"
import { ChangeEvent } from "react"
import toast from "react-hot-toast"
import { LuCopy, LuHistory, LuPlay } from "react-icons/lu"
import { PiCaretDownBold } from "react-icons/pi"
import { motion } from "framer-motion"

function RunView() {
    const { viewHeight } = useResponsive()
    const {
        setInput,
        output,
        input,
        isRunning,
        supportedLanguages,
        selectedLanguage,
        setSelectedLanguage,
        runCode,
        runHistory,
        rerunHistoryEntry,
    } = useRunCode()

    const handleLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const lang = JSON.parse(e.target.value)
        setSelectedLanguage(lang)
    }

    const copyOutput = () => {
        navigator.clipboard.writeText(output)
        toast.success("Output copied to clipboard")
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center gap-2 p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">Run Code</h1>
            <div className="flex h-[90%] w-full flex-col items-end gap-2 md:h-[92%]">
                <div className="relative w-full">
                    <select
                        className="w-full rounded-xl border border-blue-300/30 bg-slate-900/80 px-4 py-2.5 text-slate-100 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.22)]"
                        value={JSON.stringify(selectedLanguage)}
                        onChange={handleLanguageChange}
                    >
                        {supportedLanguages
                            .sort((a, b) => (a.language > b.language ? 1 : -1))
                            .map((lang, i) => {
                                return (
                                    <option
                                        key={i}
                                        value={JSON.stringify(lang)}
                                    >
                                        {lang.language +
                                            (lang.version
                                                ? ` (${lang.version})`
                                                : "")}
                                    </option>
                                )
                            })}
                    </select>
                    <PiCaretDownBold
                        size={16}
                        className="absolute bottom-3.5 right-4 z-10 text-slate-300"
                    />
                </div>
                <textarea
                    className="min-h-[120px] w-full resize-none rounded-xl border border-blue-300/30 bg-slate-900/80 p-3 text-slate-100 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.22)]"
                    placeholder="Write you input here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button
                    className="flex w-full justify-center rounded-xl bg-blue-500 p-2.5 font-bold text-white outline-none transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={runCode}
                    disabled={isRunning}
                >
                    Run
                </button>
                <label className="flex w-full justify-between text-sm text-slate-200">
                    Output:
                    <button onClick={copyOutput} title="Copy Output">
                        <LuCopy
                            size={18}
                            className="cursor-pointer text-slate-200"
                        />
                    </button>
                </label>
                <div className="w-full flex-grow resize-none overflow-y-auto rounded-xl border border-blue-300/25 bg-slate-900/75 p-3 text-slate-100 outline-none">
                    <code>
                        <pre className="text-wrap">{output}</pre>
                    </code>
                </div>

                <div className="w-full rounded-xl border border-blue-300/25 bg-slate-900/70 p-2">
                    <div className="mb-2 flex items-center gap-2 text-sm text-slate-200">
                        <LuHistory size={16} />
                        Run History
                    </div>
                    <div className="max-h-[170px] overflow-y-auto">
                        {runHistory.length === 0 && (
                            <p className="px-2 py-2 text-xs text-slate-400">
                                No runs yet.
                            </p>
                        )}
                        {runHistory.map((entry) => (
                            <div
                                key={entry.id}
                                className="mb-1.5 rounded-lg border border-blue-300/15 bg-slate-950/70 p-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-xs text-slate-200">
                                        {entry.fileName} • {entry.language}
                                    </p>
                                    <button
                                        onClick={() =>
                                            rerunHistoryEntry(entry.id)
                                        }
                                        className="flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-400"
                                    >
                                        <LuPlay size={12} />
                                        Rerun
                                    </button>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                                    {entry.output || "(no output)"}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default RunView
