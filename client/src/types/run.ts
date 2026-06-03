interface Language {
    language: string
    version: string
    aliases: string[]
    judge0Id?: number
}

interface RunHistoryEntry {
    id: string
    fileName: string
    language: string
    input: string
    output: string
    sourceCode: string
    timestamp: string
}

interface RunContext {
    input: string
    setInput: (input: string) => void
    output: string
    isRunning: boolean
    supportedLanguages: Language[]
    selectedLanguage: Language
    setSelectedLanguage: (language: Language) => void
    runCode: () => void
    runHistory: RunHistoryEntry[]
    rerunHistoryEntry: (entryId: string) => void
}

export { Language, RunContext, RunHistoryEntry }
