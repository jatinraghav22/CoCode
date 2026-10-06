import { useState, useCallback, useEffect } from "react"
import Navbar from "@/components/common/Navbar"
import PersonalFilesPanel from "@/components/compiler/PersonalFilesPanel"
import PersonalEditorPanel from "@/components/compiler/PersonalEditorPanel"
import PersonalOutputPanel from "@/components/compiler/PersonalOutputPanel"
import { usePersonalWorkspace } from "@/context/PersonalWorkspaceContext"
import { useRunCode } from "@/context/RunCodeContext"
import Split from "react-split"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { HiOutlineDocumentText, HiOutlineCode, HiOutlineTerminal } from "react-icons/hi"

const PersonalCompilerPage = () => {
    const { activeFile } = usePersonalWorkspace()
    const { input, selectedLanguage, executeCustomCode, setSelectedLanguage, supportedLanguages } = useRunCode()
    const { isMobile, width } = useWindowDimensions()
    const [mobileTab, setMobileTab] = useState("editor") // "files" | "editor" | "output"

    // Sync selected language when active file changes in personal workspace
    useEffect(() => {
        if (!activeFile?.name || !supportedLanguages || supportedLanguages.length === 0) return
        const ext = activeFile.name.split(".").pop()?.toLowerCase()
        if (ext) {
            const matched = supportedLanguages.find(
                (l) => l.extension === ext || l.aliases?.includes(ext) || l.language === ext,
            )
            if (matched) {
                setSelectedLanguage(matched)
            }
        }
    }, [activeFile?.name, supportedLanguages, setSelectedLanguage])

    const handleRunCode = useCallback(async () => {
        if (!activeFile) return
        await executeCustomCode(
            activeFile.content || "",
            input,
            selectedLanguage,
            activeFile.name,
        )
        if (isMobile) {
            setMobileTab("output")
        }
    }, [activeFile, executeCustomCode, input, isMobile, selectedLanguage])

    const getGutter = () => {
        const gutter = document.createElement("div")
        gutter.className = "hidden md:block h-full cursor-col-resize transition-colors bg-[#1e293b] hover:bg-[#38bdf8]"
        return gutter
    }

    const getGutterStyle = () => ({
        width: "6px",
        display: !isMobile ? "block" : "none",
    })

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <Navbar />

            {/* Mobile View Tab Switcher */}
            {isMobile && (
                <div className="flex w-full items-center border-b border-slate-800 bg-slate-900/90 px-2 py-1.5">
                    <button
                        onClick={() => setMobileTab("files")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                            mobileTab === "files"
                                ? "bg-blue-600/30 text-cyan-300 border border-cyan-400/30"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <HiOutlineDocumentText className="text-sm" />
                        Files
                    </button>

                    <button
                        onClick={() => setMobileTab("editor")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                            mobileTab === "editor"
                                ? "bg-blue-600/30 text-cyan-300 border border-cyan-400/30"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <HiOutlineCode className="text-sm" />
                        Editor
                    </button>

                    <button
                        onClick={() => setMobileTab("output")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                            mobileTab === "output"
                                ? "bg-blue-600/30 text-cyan-300 border border-cyan-400/30"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <HiOutlineTerminal className="text-sm" />
                        Output
                    </button>
                </div>
            )}

            {/* Main Compiler Panels */}
            <main className="flex flex-1 overflow-hidden">
                {!isMobile ? (
                    <Split
                        sizes={[20, 50, 30]}
                        minSize={[180, 300, 240]}
                        maxSize={[380, Infinity, 650]}
                        gutter={getGutter}
                        gutterStyle={getGutterStyle}
                        dragInterval={1}
                        direction="horizontal"
                        className="flex h-full w-full overflow-hidden"
                    >
                        {/* 1. Files Panel */}
                        <div className="h-full overflow-hidden">
                            <PersonalFilesPanel />
                        </div>

                        {/* 2. Code Editor Panel */}
                        <div className="h-full overflow-hidden">
                            <PersonalEditorPanel onRunTrigger={handleRunCode} />
                        </div>

                        {/* 3. Output Panel */}
                        <div className="h-full overflow-hidden">
                            <PersonalOutputPanel onRun={handleRunCode} />
                        </div>
                    </Split>
                ) : (
                    <div className="h-full w-full overflow-hidden">
                        {mobileTab === "files" && (
                            <PersonalFilesPanel className="w-full border-r-0" />
                        )}
                        {mobileTab === "editor" && (
                            <PersonalEditorPanel onRunTrigger={handleRunCode} className="w-full" />
                        )}
                        {mobileTab === "output" && (
                            <PersonalOutputPanel onRun={handleRunCode} className="w-full border-l-0" />
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}

export default PersonalCompilerPage
