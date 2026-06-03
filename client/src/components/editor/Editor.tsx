import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import { useSettings } from "@/context/SettingContext"
import { useSocket } from "@/context/SocketContext"
import usePageEvents from "@/hooks/usePageEvents"
import useResponsive from "@/hooks/useResponsive"
import { editorThemes } from "@/resources/Themes"
import { FileSystemItem } from "@/types/file"
import { SocketEvent } from "@/types/socket"
import customMapping from "@/utils/customMapping"
import { color } from "@uiw/codemirror-extensions-color"
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link"
import { LanguageName, loadLanguage } from "@uiw/codemirror-extensions-langs"
import CodeMirror, {
    Extension,
    ViewUpdate,
    scrollPastEnd,
} from "@uiw/react-codemirror"
import langMap from "lang-map"
import { useEffect, useMemo, useState } from "react"
import { cursorTooltipBaseTheme, tooltipField } from "./tooltip"

const normalizeLanguageName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "")

const languageAliases: Record<string, LanguageName> = {
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

const getEditorLanguage = (fileName?: string): LanguageName | undefined => {
    if (!fileName || !fileName.includes(".")) return

    const extension = fileName.split(".").pop()?.toLowerCase()
    if (!extension) return

    const customLanguage = customMapping[extension]
    if (customLanguage) {
        const aliased = languageAliases[normalizeLanguageName(customLanguage)]
        if (aliased) return aliased
    }

    const guessedNames = langMap.languages(extension)
    for (const candidate of guessedNames) {
        const aliased = languageAliases[normalizeLanguageName(candidate)]
        if (aliased) return aliased
    }
}

function Editor() {
    const { users, currentUser } = useAppContext()
    const { activeFile, setActiveFile } = useFileSystem()
    const { theme, fontSize } = useSettings()
    const { socket } = useSocket()
    const { viewHeight } = useResponsive()
    const [timeOut, setTimeOut] = useState(setTimeout(() => {}, 0))
    const filteredUsers = useMemo(
        () => users.filter((u) => u.username !== currentUser.username),
        [users, currentUser],
    )
    const [extensions, setExtensions] = useState<Extension[]>([])
    const editorLanguage = useMemo(
        () => getEditorLanguage(activeFile?.name),
        [activeFile?.name],
    )

    const onCodeChange = (code: string, view: ViewUpdate) => {
        if (!activeFile) return

        const file: FileSystemItem = { ...activeFile, content: code }
        setActiveFile(file)
        const cursorPosition = view.state?.selection?.main?.head
        socket.emit(SocketEvent.TYPING_START, { cursorPosition })
        socket.emit(SocketEvent.FILE_UPDATED, {
            fileId: activeFile.id,
            newContent: code,
        })
        clearTimeout(timeOut)

        const newTimeOut = setTimeout(
            () => socket.emit(SocketEvent.TYPING_PAUSE),
            1000,
        )
        setTimeOut(newTimeOut)
    }

    // Listen wheel event to zoom in/out and prevent page reload
    usePageEvents()

    useEffect(() => {
        const extensions = [
            color,
            hyperLink,
            tooltipField(filteredUsers),
            cursorTooltipBaseTheme,
            scrollPastEnd(),
        ]
        const langExt = editorLanguage
            ? loadLanguage(editorLanguage)
            : undefined
        if (langExt) {
            extensions.push(langExt)
        }

        setExtensions(extensions)
    }, [editorLanguage, filteredUsers])

    return (
        <CodeMirror
            theme={editorThemes[theme]}
            onChange={onCodeChange}
            value={activeFile?.content}
            extensions={extensions}
            minHeight="100%"
            maxWidth="100vw"
            style={{
                fontSize: fontSize + "px",
                height: viewHeight,
                position: "relative",
            }}
        />
    )
}

export default Editor
