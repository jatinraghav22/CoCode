import {
    Judge0Language,
    Judge0SubmissionResponse,
    createJudge0Submission,
    getJudge0Languages,
    getJudge0Submission,
} from "@/api/judge0Api"
import {
    Language,
    RunContext as RunContextType,
    RunHistoryEntry,
} from "@/types/run"
import { SocketEvent } from "@/types/socket"
import { AxiosError } from "axios"
import langMap from "lang-map"
import {
    Dispatch,
    ReactNode,
    SetStateAction,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import toast from "react-hot-toast"
import { useAppContext } from "./AppContext"
import { useFileSystem } from "./FileContext"
import { useSocket } from "./SocketContext"

const RunCodeContext = createContext<RunContextType | null>(null)

const languageAliases: Record<string, string[]> = {
    bash: ["sh", "bash"],
    c: ["c", "h"],
    cpp: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"],
    csharp: ["cs"],
    go: ["go"],
    java: ["java"],
    javascript: ["js", "mjs", "cjs", "jsx"],
    kotlin: ["kt", "kts"],
    lua: ["lua"],
    objectivec: ["m", "mm"],
    perl: ["pl"],
    php: ["php"],
    python: ["py"],
    ruby: ["rb"],
    rust: ["rs"],
    scala: ["scala"],
    swift: ["swift"],
    typescript: ["ts", "tsx"],
}

const normalizeLanguageName = (name: string): string => {
    const normalized = name.trim().toLowerCase()

    if (normalized.includes("c++")) return "cpp"
    if (normalized.includes("c#")) return "csharp"
    if (normalized.includes("objective-c")) return "objectivec"
    if (normalized.includes("node") || normalized.includes("javascript")) {
        return "javascript"
    }

    return normalized.replace(/[^a-z0-9]/g, "")
}

const mapJudge0LanguageToRunLanguage = (runtime: Judge0Language): Language => {
    const nameMatch = runtime.name.match(/^(.+?)\s*\((.+)\)$/)
    const rawLanguage = nameMatch ? nameMatch[1].trim() : runtime.name.trim()
    const version = nameMatch ? nameMatch[2].trim() : ""
    const language = normalizeLanguageName(rawLanguage)

    return {
        language,
        version,
        aliases: [...new Set([language, ...(languageAliases[language] ?? [])])],
        judge0Id: runtime.id,
    }
}

const getSubmissionOutput = (submission: Judge0SubmissionResponse): string => {
    return (
        submission.stderr ||
        submission.compile_output ||
        submission.stdout ||
        submission.message ||
        submission.status?.description ||
        ""
    )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const pollForSubmissionResult = async (
    token: string,
): Promise<Judge0SubmissionResponse> => {
    const maxAttempts = 20

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const submission = await getJudge0Submission(token)
        const statusId = submission.status?.id

        if (!statusId || statusId > 2) {
            return submission
        }

        await wait(700)
    }

    throw new Error("Timed out while waiting for code execution result")
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRunCode = () => {
    const context = useContext(RunCodeContext)
    if (context === null) {
        throw new Error(
            "useRunCode must be used within a RunCodeContextProvider",
        )
    }
    return context
}

const RunCodeContextProvider = ({ children }: { children: ReactNode }) => {
    const { activeFile } = useFileSystem()
    const { currentUser } = useAppContext()
    const { socket } = useSocket()
    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)
    const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([])
    const [runHistory, setRunHistory]: [
        RunHistoryEntry[],
        Dispatch<SetStateAction<RunHistoryEntry[]>>,
    ] = useState<RunHistoryEntry[]>([])
    const [selectedLanguage, setSelectedLanguage] = useState<Language>({
        language: "",
        version: "",
        aliases: [],
    })

    const addRunHistory = (
        fileName: string,
        language: string,
        sourceCode: string,
        stdin: string,
        finalOutput: string,
    ) => {
        const entry: RunHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName,
            language,
            input: stdin,
            output: finalOutput,
            sourceCode,
            timestamp: new Date().toISOString(),
        }

        setRunHistory((previous) => [entry, ...previous].slice(0, 18))
    }

    const executeCode = async (
        sourceCode: string,
        stdinValue: string,
        language: Language,
    ) => {
        const judge0Id = language.judge0Id
        if (!judge0Id) {
            throw new Error("Selected language is missing Judge0 id")
        }

        let submission: Judge0SubmissionResponse

        try {
            submission = await createJudge0Submission(
                {
                    language_id: judge0Id,
                    source_code: sourceCode,
                    stdin: stdinValue,
                },
                true,
            )
        } catch (error) {
            const axiosError = error as AxiosError<{ error?: string }>
            const errorMessage =
                axiosError.response?.data?.error?.toLowerCase() ?? ""

            if (!errorMessage.includes("wait not allowed")) {
                throw error
            }

            const queuedSubmission = await createJudge0Submission(
                {
                    language_id: judge0Id,
                    source_code: sourceCode,
                    stdin: stdinValue,
                },
                false,
            )

            if (!queuedSubmission.token) {
                throw new Error("Submission token was not returned by Judge0")
            }

            submission = await pollForSubmissionResult(queuedSubmission.token)
        }

        return getSubmissionOutput(submission)
    }

    useEffect(() => {
        const fetchSupportedLanguages = async () => {
            try {
                const languages = await getJudge0Languages()
                setSupportedLanguages(
                    languages.map(mapJudge0LanguageToRunLanguage),
                )
            } catch (error) {
                toast.error("Failed to fetch supported languages")
                const axiosError = error as AxiosError
                if (axiosError?.response?.data) {
                    console.error(axiosError.response.data)
                }
            }
        }

        fetchSupportedLanguages()
    }, [])

    // Set the selected language based on the file extension
    useEffect(() => {
        if (supportedLanguages.length === 0 || !activeFile?.name) return

        const extension = activeFile.name.split(".").pop()
        if (extension) {
            const lowerCaseExtension = extension.toLowerCase()
            const languageName = langMap
                .languages(lowerCaseExtension)
                .map((name) => name.toLowerCase())
            const language = supportedLanguages.find(
                (lang) =>
                    lang.aliases.includes(lowerCaseExtension) ||
                    languageName.some((name) =>
                        name.includes(lang.language.toLowerCase()),
                    ),
            )
            if (language) setSelectedLanguage(language)
        } else setSelectedLanguage({ language: "", version: "", aliases: [] })
    }, [activeFile?.name, supportedLanguages])

    const runCode = async () => {
        try {
            if (!selectedLanguage) {
                return toast.error("Please select a language to run the code")
            } else if (!activeFile) {
                return toast.error("Please open a file to run the code")
            } else if (!selectedLanguage.judge0Id) {
                return toast.error(
                    "This language is not available for execution",
                )
            } else {
                toast.loading("Running code...")
            }

            setIsRunning(true)
            const sourceCode = activeFile.content ?? ""
            const finalOutput = await executeCode(
                sourceCode,
                input,
                selectedLanguage,
            )

            setOutput(finalOutput)
            addRunHistory(
                activeFile.name,
                selectedLanguage.language,
                sourceCode,
                input,
                finalOutput,
            )

            socket.emit(SocketEvent.CODE_EXECUTED, {
                roomId: currentUser.roomId,
                fileName: activeFile.name,
                language: selectedLanguage.language,
            })

            setIsRunning(false)
            toast.dismiss()
        } catch (error) {
            const axiosError = error as AxiosError
            console.error(axiosError?.response?.data || error)
            setIsRunning(false)
            toast.dismiss()
            toast.error("Failed to run the code")
        }
    }

    const rerunHistoryEntry = async (entryId: string) => {
        const targetEntry = runHistory.find((entry) => entry.id === entryId)
        if (!targetEntry) return

        const language = supportedLanguages.find(
            (lang) => lang.language === targetEntry.language,
        )
        if (!language) {
            toast.error("Language no longer available for rerun")
            return
        }

        try {
            toast.loading("Rerunning history entry...")
            setIsRunning(true)
            setInput(targetEntry.input)
            setSelectedLanguage(language)
            const finalOutput = await executeCode(
                targetEntry.sourceCode,
                targetEntry.input,
                language,
            )
            setOutput(finalOutput)
            addRunHistory(
                targetEntry.fileName,
                targetEntry.language,
                targetEntry.sourceCode,
                targetEntry.input,
                finalOutput,
            )
            toast.dismiss()
        } catch (error) {
            const axiosError = error as AxiosError
            console.error(axiosError?.response?.data || error)
            toast.dismiss()
            toast.error("Failed to rerun history entry")
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <RunCodeContext.Provider
            value={{
                input,
                setInput,
                output,
                isRunning,
                supportedLanguages,
                selectedLanguage,
                setSelectedLanguage,
                runCode,
                runHistory,
                rerunHistoryEntry,
            }}
        >
            {children}
        </RunCodeContext.Provider>
    )
}

export { RunCodeContextProvider }
export default RunCodeContext
