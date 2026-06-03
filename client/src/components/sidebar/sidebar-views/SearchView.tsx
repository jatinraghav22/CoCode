import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useAppContext } from "@/context/AppContext"
import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import { ACTIVITY_STATE } from "@/types/app"
import { FileSystemItem } from "@/types/file"

type SearchResult = {
    id: string
    name: string
    path: string
    contentPreview: string | null
}

const PREVIEW_LENGTH = 120

const walkFiles = (node: FileSystemItem, parentPath = ""): SearchResult[] => {
    if (node.type === "file") {
        return [
            {
                id: node.id,
                name: node.name,
                path: `${parentPath}/${node.name}`,
                contentPreview: node.content || "",
            },
        ]
    }

    return (node.children || []).flatMap((child) =>
        walkFiles(child, parentPath ? `${parentPath}/${node.name}` : node.name),
    )
}

const getPreview = (content: string, term: string): string | null => {
    const source = content || ""
    if (!source) return null

    const normalized = source.toLowerCase()
    const index = normalized.indexOf(term)
    if (index === -1) {
        return source.slice(0, PREVIEW_LENGTH)
    }

    const start = Math.max(0, index - Math.floor(PREVIEW_LENGTH / 3))
    const end = Math.min(source.length, start + PREVIEW_LENGTH)
    return source.slice(start, end)
}

const highlight = (text: string, term: string) => {
    if (!term.trim()) return text
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const parts = text.split(new RegExp(`(${escapedTerm})`, "ig"))

    return parts.map((part, index) => {
        const isMatch = part.toLowerCase() === term.toLowerCase()
        if (!isMatch) return <span key={`${part}-${index}`}>{part}</span>

        return (
            <mark
                key={`${part}-${index}`}
                className="rounded bg-cyan-400/25 px-0.5 text-cyan-100"
            >
                {part}
            </mark>
        )
    })
}

function SearchView() {
    const { viewHeight } = useResponsive()
    const { setActivityState } = useAppContext()
    const { fileStructure, openFile } = useFileSystem()
    const [query, setQuery] = useState("")

    const openFromSearch = (fileId: string) => {
        setActivityState(ACTIVITY_STATE.CODING)
        openFile(fileId)
    }

    const allFiles = useMemo(() => walkFiles(fileStructure), [fileStructure])

    const results = useMemo(() => {
        const term = query.trim().toLowerCase()
        if (!term) return []

        return allFiles
            .filter((file) => {
                const inName = file.name.toLowerCase().includes(term)
                const inPath = file.path.toLowerCase().includes(term)
                const inContent =
                    file.contentPreview?.toLowerCase().includes(term) || false

                return inName || inPath || inContent
            })
            .map((file) => ({
                ...file,
                contentPreview: getPreview(file.contentPreview || "", term),
            }))
            .slice(0, 80)
    }, [allFiles, query])

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex max-h-full min-h-[400px] w-full flex-col gap-3 p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">Search</h1>

            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files and content..."
                className="w-full rounded-xl border border-blue-300/30 bg-slate-900/80 px-4 py-2.5 text-slate-100 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.22)]"
            />

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-blue-300/20 bg-slate-900/55 p-2">
                {!query.trim() && (
                    <p className="px-2 py-3 text-sm text-slate-400">
                        Search by file name, path, or file content.
                    </p>
                )}

                {query.trim() && results.length === 0 && (
                    <p className="px-2 py-3 text-sm text-slate-400">
                        No matches found for "{query}".
                    </p>
                )}

                {results.map((result) => (
                    <button
                        key={result.id}
                        onClick={() => openFromSearch(result.id)}
                        className="w-full rounded-lg border border-blue-300/20 bg-slate-950/70 px-3 py-2 text-left transition hover:bg-blue-500/15"
                    >
                        <p className="truncate text-sm font-medium text-slate-100">
                            {highlight(result.name, query.trim())}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                            {highlight(result.path, query.trim())}
                        </p>
                        {result.contentPreview && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                                {highlight(result.contentPreview, query.trim())}
                            </p>
                        )}
                    </button>
                ))}
            </div>
        </motion.div>
    )
}

export default SearchView
