import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useFileSystem } from "@/context/FileContext"
import useResponsive from "@/hooks/useResponsive"
import { formatDate } from "@/utils/formateDate"

const buildDiffPreview = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split("\n")
    const newLines = newContent.split("\n")
    const max = Math.max(oldLines.length, newLines.length)
    const preview: string[] = []

    for (let index = 0; index < max && preview.length < 24; index += 1) {
        const oldLine = oldLines[index] ?? ""
        const newLine = newLines[index] ?? ""

        if (oldLine === newLine) {
            preview.push(`  ${newLine}`)
            continue
        }

        if (oldLine) preview.push(`- ${oldLine}`)
        if (newLine) preview.push(`+ ${newLine}`)
    }

    return preview.join("\n")
}

function HistoryView() {
    const { viewHeight } = useResponsive()
    const { activeFile, getVersionsForFile, restoreVersion } = useFileSystem()
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
        null,
    )

    const fileVersions = useMemo(() => {
        if (!activeFile) return []
        return getVersionsForFile(activeFile.id)
    }, [activeFile, getVersionsForFile])

    const selectedVersion = fileVersions.find(
        (version) => version.id === selectedVersionId,
    )

    const diffPreview = useMemo(() => {
        if (!selectedVersion || !activeFile) return ""
        return buildDiffPreview(
            selectedVersion.content,
            activeFile.content || "",
        )
    }, [selectedVersion, activeFile])

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex max-h-full min-h-[400px] w-full flex-col gap-2 p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">Version History</h1>

            {!activeFile && (
                <div className="rounded-xl border border-blue-300/20 bg-slate-900/65 p-3 text-sm text-slate-400">
                    Open a file to inspect version history.
                </div>
            )}

            {activeFile && (
                <>
                    <div className="rounded-xl border border-blue-300/20 bg-slate-900/65 p-3 text-sm text-slate-200">
                        Active file:{" "}
                        <span className="text-cyan-200">{activeFile.name}</span>
                    </div>

                    <div className="flex min-h-0 flex-1 gap-2">
                        <div className="w-[46%] overflow-y-auto rounded-xl border border-blue-300/20 bg-slate-900/65 p-2">
                            {fileVersions.length === 0 && (
                                <p className="p-2 text-xs text-slate-400">
                                    No snapshots yet for this file.
                                </p>
                            )}

                            {fileVersions.map((version, index) => (
                                <button
                                    key={version.id}
                                    onClick={() =>
                                        setSelectedVersionId(version.id)
                                    }
                                    className={`mb-1.5 w-full rounded-lg border p-2 text-left transition ${
                                        selectedVersionId === version.id
                                            ? "border-cyan-300/40 bg-cyan-500/10"
                                            : "border-blue-300/15 bg-slate-950/70 hover:bg-blue-500/15"
                                    }`}
                                >
                                    <p className="text-xs text-slate-200">
                                        Snapshot {fileVersions.length - index}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {formatDate(version.timestamp)}
                                    </p>
                                </button>
                            ))}
                        </div>

                        <div className="flex w-[54%] flex-col rounded-xl border border-blue-300/20 bg-slate-900/65 p-2">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs text-slate-300">
                                    Diff Preview
                                </p>
                                {selectedVersion && (
                                    <button
                                        onClick={() =>
                                            restoreVersion(selectedVersion.id)
                                        }
                                        className="rounded-md bg-blue-500 px-2.5 py-1 text-xs text-white hover:bg-blue-400"
                                    >
                                        Revert To This
                                    </button>
                                )}
                            </div>

                            <pre className="flex-1 overflow-auto rounded-lg border border-blue-300/15 bg-slate-950/75 p-2 text-[11px] leading-5 text-slate-200">
                                {diffPreview ||
                                    "Select a snapshot to preview changes."}
                            </pre>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    )
}

export default HistoryView
