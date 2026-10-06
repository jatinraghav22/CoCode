import { useEffect, useMemo, useState } from "react"
import { usePersonalWorkspace } from "@/context/PersonalWorkspaceContext"
import { useSettings } from "@/context/SettingContext"
import { editorThemes } from "@/resources/Themes"
import CodeMirror, { scrollPastEnd } from "@uiw/react-codemirror"
import { color } from "@uiw/codemirror-extensions-color"
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link"
import { loadLanguage } from "@uiw/codemirror-extensions-langs"
import customMapping from "@/utils/customMapping"
import langMap from "lang-map"
import { HiOutlineX, HiOutlinePlus, HiOutlineCode } from "react-icons/hi"
import {
    SiCplusplus,
    SiPython,
    SiJavascript,
    SiTypescript,
    SiRust,
    SiGo,
    SiPhp,
    SiHtml5,
    SiCss3,
    SiMarkdown,
} from "react-icons/si"
import { FaJava } from "react-icons/fa"
import { TbBrandCSharp } from "react-icons/tb"

const getFileIcon = (fileName) => {
    const ext = (fileName || "").split(".").pop()?.toLowerCase()
    switch (ext) {
        case "cpp":
        case "cc":
        case "cxx":
        case "hpp":
            return <SiCplusplus className="text-blue-400" />
        case "c":
        case "h":
            return <SiCplusplus className="text-cyan-400" />
        case "py":
            return <SiPython className="text-amber-400" />
        case "js":
        case "jsx":
        case "mjs":
            return <SiJavascript className="text-yellow-400" />
        case "ts":
        case "tsx":
            return <SiTypescript className="text-blue-400" />
        case "java":
            return <FaJava className="text-orange-400" />
        case "rs":
            return <SiRust className="text-orange-300" />
        case "go":
            return <SiGo className="text-cyan-300" />
        case "cs":
            return <TbBrandCSharp className="text-purple-400" />
        case "php":
            return <SiPhp className="text-indigo-300" />
        case "html":
            return <SiHtml5 className="text-orange-500" />
        case "css":
            return <SiCss3 className="text-blue-500" />
        case "md":
            return <SiMarkdown className="text-slate-300" />
        default:
            return <HiOutlineCode className="text-slate-400" />
    }
}

const languageAliases = {
    c: "c",
    csharp: "csharp",
    cplusplus: "cpp",
    cpp: "cpp",
    css: "css",
    go: "go",
    html: "html",
    java: "java",
    javascript: "javascript",
    json: "json",
    jsx: "jsx",
    kotlin: "kotlin",
    markdown: "markdown",
    php: "php",
    python: "python",
    ruby: "ruby",
    rust: "rust",
    shell: "shell",
    sql: "sql",
    swift: "swift",
    typescript: "typescript",
    tsx: "tsx",
    xml: "xml",
    yaml: "yaml",
}

const normalizeLanguageName = (name) =>
    (name || "").toLowerCase().replace(/[^a-z0-9]/g, "")

const getEditorLanguage = (fileName) => {
    if (!fileName || !fileName.includes(".")) return "cpp"

    const extension = fileName.split(".").pop()?.toLowerCase()
    if (!extension) return "cpp"

    const customLang = customMapping[extension]
    if (customLang) {
        const aliased = languageAliases[normalizeLanguageName(customLang)]
        if (aliased) return aliased
    }

    const candidates = langMap.languages(extension) || []
    for (const cand of candidates) {
        const aliased = languageAliases[normalizeLanguageName(cand)]
        if (aliased) return aliased
    }

    return extension
}

const PersonalEditorPanel = ({ onRunTrigger, className = "" }) => {
    const {
        openFiles,
        activeFile,
        setActiveFile,
        closeFile,
        updateFileContent,
        createFile,
    } = usePersonalWorkspace()

    const { theme, fontSize } = useSettings()
    const [extensions, setExtensions] = useState([])

    const editorLanguage = useMemo(
        () => getEditorLanguage(activeFile?.name),
        [activeFile?.name],
    )

    useEffect(() => {
        const exts = [color, hyperLink, scrollPastEnd()]
        if (editorLanguage) {
            try {
                const langExt = loadLanguage(editorLanguage)
                if (langExt) {
                    exts.push(langExt)
                }
            } catch (err) {
                console.warn("Error loading language for editor:", err)
            }
        }
        setExtensions(exts)
    }, [editorLanguage])

    // Keyboard shortcut Ctrl+Enter / Cmd+Enter to Run
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault()
            onRunTrigger?.()
        }
    }

    if (!activeFile || openFiles.length === 0) {
        return (
            <div className={`flex h-full w-full flex-col items-center justify-center bg-slate-950 p-6 ${className}`}>
                <div className="glass-panel max-w-md p-8 text-center border-slate-800">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-cyan-400">
                        <HiOutlineCode className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white">No File Open</h3>
                    <p className="mt-2 text-xs text-slate-400">
                        Create or select a file from the Files explorer to start writing code.
                    </p>
                    <button
                        onClick={() => createFile("main.cpp")}
                        className="btn-primary mt-5 px-4 py-2 text-xs font-semibold"
                    >
                        Create main.cpp
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`flex h-full flex-col overflow-hidden bg-slate-950/90 ${className}`}
            onKeyDown={handleKeyDown}
        >
            {/* Tabs Header */}
            <div className="flex h-10 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/95 px-2">
                <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
                    {openFiles.map((file) => {
                        const isActive = activeFile?.id === file.id
                        return (
                            <div
                                key={file.id}
                                onClick={() => setActiveFile(file)}
                                className={`group flex cursor-pointer items-center gap-2 rounded-t-lg border-b-2 px-3 py-1.5 text-xs transition ${
                                    isActive
                                        ? "border-cyan-400 bg-slate-900/90 text-cyan-200 font-semibold shadow-[0_-2px_10px_rgba(56,131,255,0.15)]"
                                        : "border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                                }`}
                            >
                                <span className="text-sm">{getFileIcon(file.name)}</span>
                                <span className="max-w-[120px] truncate">{file.name}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        closeFile(file.id)
                                    }}
                                    title="Close tab"
                                    className="rounded p-0.5 opacity-60 transition hover:bg-slate-700/60 hover:opacity-100"
                                >
                                    <HiOutlineX className="h-3 w-3" />
                                </button>
                            </div>
                        )
                    })}

                    <button
                        onClick={() => {
                            const name = prompt("Enter file name (e.g. solution.cpp, test.py):")
                            if (name) createFile(name)
                        }}
                        title="New File"
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                        <HiOutlinePlus className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 pr-2">
                    <span>Ctrl + Enter to Run</span>
                </div>
            </div>

            {/* CodeMirror Editor Area */}
            <div className="flex-1 overflow-hidden">
                <CodeMirror
                    theme={editorThemes[theme]}
                    value={activeFile?.content || ""}
                    onChange={(val) => updateFileContent(activeFile.id, val)}
                    extensions={extensions}
                    height="100%"
                    style={{
                        fontSize: `${fontSize}px`,
                        height: "100%",
                    }}
                    basicSetup={{
                        lineNumbers: true,
                        highlightActiveLineGutter: true,
                        highlightSpecialChars: true,
                        history: true,
                        foldGutter: true,
                        drawSelection: true,
                        dropCursor: true,
                        allowMultipleSelections: true,
                        indentOnInput: true,
                        syntaxHighlighting: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        autocompletion: true,
                        rectangularSelection: true,
                        crosshairCursor: true,
                        highlightActiveLine: true,
                        highlightSelectionMatches: true,
                        closeBracketsKeymap: true,
                        defaultKeymap: true,
                        searchKeymap: true,
                        historyKeymap: true,
                        foldKeymap: true,
                        completionKeymap: true,
                        lintKeymap: true,
                    }}
                />
            </div>
        </div>
    )
}

export default PersonalEditorPanel
