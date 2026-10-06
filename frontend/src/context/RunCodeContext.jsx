import {
    DEFAULT_LANGUAGES,
    fetchSupportedLanguages,
    runCodeExecution,
} from "@/api/executeApi"
import { SocketEvent } from "@/types/socket"
import langMap from "lang-map"
import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import toast from "react-hot-toast"
import { useAppContext } from "./AppContext"
import { useFileSystem } from "./FileContext"
import { useSocket } from "./SocketContext"

const RunCodeContext = createContext(null)

export const useRunCode = () => {
    const context = useContext(RunCodeContext)
    if (context === null) {
        throw new Error(
            "useRunCode must be used within a RunCodeContextProvider",
        )
    }
    return context
}

const RunCodeContextProvider = ({ children }) => {
    const { activeFile } = useFileSystem()
    const { currentUser } = useAppContext()
    const { socket } = useSocket()
    const [input, setInput] = useState("")
    const [output, setOutput] = useState("")
    const [isRunning, setIsRunning] = useState(false)
    const [supportedLanguages, setSupportedLanguages] = useState(DEFAULT_LANGUAGES)
    const [runHistory, setRunHistory] = useState([])
    const [executionStatus, setExecutionStatus] = useState("Ready")
    const [isErrorState, setIsErrorState] = useState(false)
    const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGES[0])

    const addRunHistory = (
        fileName,
        language,
        sourceCode,
        stdin,
        finalOutput,
        status = "Success",
    ) => {
        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName: fileName || "main.cpp",
            language,
            input: stdin,
            output: finalOutput,
            sourceCode,
            status,
            timestamp: new Date().toISOString(),
        }

        setRunHistory((previous) => [entry, ...previous].slice(0, 20))
    }

    useEffect(() => {
        let isMounted = true
        const loadLanguages = async () => {
            try {
                const languages = await fetchSupportedLanguages()
                if (isMounted && languages && languages.length > 0) {
                    setSupportedLanguages(languages)
                }
            } catch (error) {
                console.warn("Using default language list due to fetch error:", error)
            }
        }

        loadLanguages()
        return () => {
            isMounted = false
        }
    }, [])

    // Set the selected language based on the active file extension
    useEffect(() => {
        if (!activeFile?.name || supportedLanguages.length === 0) return

        const extension = activeFile.name.split(".").pop()?.toLowerCase()
        if (extension) {
            const languageName = langMap
                .languages(extension)
                .map((name) => name.toLowerCase())
            const matched = supportedLanguages.find(
                (lang) =>
                    lang.extension === extension ||
                    lang.aliases?.includes(extension) ||
                    languageName.some((name) =>
                        name.includes(lang.language?.toLowerCase()),
                    ),
            )
            if (matched) setSelectedLanguage(matched)
        }
    }, [activeFile?.name, supportedLanguages])

    const executeCustomCode = async (customCode, customStdin, targetLanguage, targetFileName) => {
        const codeToRun = customCode !== undefined ? customCode : (activeFile?.content ?? "")
        const stdinToRun = customStdin !== undefined ? customStdin : input
        const langToRun = targetLanguage || selectedLanguage || supportedLanguages[0]
        const fileNameToRun = targetFileName || activeFile?.name || "main.cpp"

        if (!langToRun) {
            toast.error("Please select a programming language")
            return
        }

        try {
            setIsRunning(true)
            setExecutionStatus("Running...")
            setIsErrorState(false)
            toast.loading("Running code...")

            const result = await runCodeExecution(codeToRun, stdinToRun, langToRun)

            setOutput(result.output)
            setIsErrorState(Boolean(result.isError))
            setExecutionStatus(result.status || (result.isError ? "Error" : "Success"))

            addRunHistory(
                fileNameToRun,
                langToRun.name || langToRun.language,
                codeToRun,
                stdinToRun,
                result.output,
                result.status || (result.isError ? "Error" : "Success"),
            )

            if (socket && currentUser?.roomId) {
                socket.emit(SocketEvent.CODE_EXECUTED, {
                    roomId: currentUser.roomId,
                    fileName: fileNameToRun,
                    language: langToRun.language,
                })
            }

            toast.dismiss()
            if (result.isError) {
                toast.error("Execution finished with errors")
            } else {
                toast.success("Execution completed successfully!")
            }
        } catch (error) {
            console.error("Execution error:", error)
            const errorMsg = error.message || "Failed to execute code"
            setOutput(`Execution Error:\n${errorMsg}`)
            setIsErrorState(true)
            setExecutionStatus("Error")
            toast.dismiss()
            toast.error(errorMsg)
        } finally {
            setIsRunning(false)
        }
    }

    const runCode = async () => {
        if (!activeFile) {
            return toast.error("Please open a file to run the code")
        }
        await executeCustomCode(activeFile.content ?? "", input, selectedLanguage, activeFile.name)
    }

    const rerunHistoryEntry = async (entryId) => {
        const targetEntry = runHistory.find((entry) => entry.id === entryId)
        if (!targetEntry) return

        const language = supportedLanguages.find(
            (lang) => lang.language === targetEntry.language || lang.name === targetEntry.language,
        ) || supportedLanguages[0]

        setInput(targetEntry.input || "")
        setSelectedLanguage(language)
        await executeCustomCode(
            targetEntry.sourceCode,
            targetEntry.input,
            language,
            targetEntry.fileName,
        )
    }

    const clearOutput = () => {
        setOutput("")
        setExecutionStatus("Ready")
        setIsErrorState(false)
        toast.success("Console output cleared")
    }

    return (
        <RunCodeContext.Provider
            value={{
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
                runCode,
                executeCustomCode,
                runHistory,
                rerunHistoryEntry,
                clearOutput,
            }}
        >
            {children}
        </RunCodeContext.Provider>
    )
}

export { RunCodeContextProvider }
export default RunCodeContext
