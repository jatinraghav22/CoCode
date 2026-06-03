import { useCopilot } from "@/context/CopilotContext"
import { useFileSystem } from "@/context/FileContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { SocketEvent } from "@/types/socket"
import toast from "react-hot-toast"
import { LuClipboardPaste, LuCopy, LuRepeat } from "react-icons/lu"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useState } from "react"
import { ConfirmModal } from "@/components/common/Modal"
import { motion } from "framer-motion"

function CopilotView() {
    const { socket } = useSocket()
    const { viewHeight } = useResponsive()
    const { generateCode, output, isRunning, setInput } = useCopilot()
    const { activeFile, updateFileContent, setActiveFile } = useFileSystem()
    const [isReplaceModalOpen, setReplaceModalOpen] = useState(false)

    const copyOutput = async () => {
        try {
            const content = output.replace(/```[\w]*\n?/g, "").trim()
            await navigator.clipboard.writeText(content)
            toast.success("Output copied to clipboard")
        } catch (error) {
            toast.error("Unable to copy output to clipboard")
            console.log(error)
        }
    }

    const pasteCodeInFile = () => {
        if (activeFile) {
            const fileContent = activeFile.content
                ? `${activeFile.content}\n`
                : ""
            const content = `${fileContent}${output.replace(/```[\w]*\n?/g, "").trim()}`
            updateFileContent(activeFile.id, content)
            // Update the content of the active file if it's the same file
            setActiveFile({ ...activeFile, content })
            toast.success("Code pasted successfully")
            // Emit the FILE_UPDATED event to the server
            socket.emit(SocketEvent.FILE_UPDATED, {
                fileId: activeFile.id,
                newContent: content,
            })
        }
    }

    const replaceCodeInFile = () => {
        if (activeFile) {
            setReplaceModalOpen(false)
            const content = output.replace(/```[\w]*\n?/g, "").trim()
            updateFileContent(activeFile.id, content)
            // Update the content of the active file if it's the same file
            setActiveFile({ ...activeFile, content })
            toast.success("Code replaced successfully")
            // Emit the FILE_UPDATED event to the server
            socket.emit(SocketEvent.FILE_UPDATED, {
                fileId: activeFile.id,
                newContent: content,
            })
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex max-h-full min-h-[400px] w-full flex-col gap-2 p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">Copilot</h1>
            <textarea
                className="min-h-[120px] w-full rounded-xl border border-blue-300/30 bg-slate-900/80 p-3 text-slate-100 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.22)]"
                placeholder="What code do you want to generate?"
                onChange={(e) => setInput(e.target.value)}
            />
            <button
                className="mt-1 flex w-full justify-center rounded-xl bg-blue-500 p-2.5 font-bold text-white outline-none transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={generateCode}
                disabled={isRunning}
            >
                {isRunning ? "Generating..." : "Generate Code"}
            </button>
            {output && (
                <div className="flex justify-end gap-4 pt-2">
                    <button
                        title="Copy Output"
                        onClick={copyOutput}
                        className="rounded-lg border border-blue-300/25 bg-slate-900/70 p-2 transition hover:bg-blue-500/20"
                    >
                        <LuCopy
                            size={18}
                            className="cursor-pointer text-slate-100"
                        />
                    </button>
                    <button
                        title="Replace code in file"
                        onClick={() => setReplaceModalOpen(true)}
                        className="rounded-lg border border-blue-300/25 bg-slate-900/70 p-2 transition hover:bg-blue-500/20"
                    >
                        <LuRepeat
                            size={18}
                            className="cursor-pointer text-slate-100"
                        />
                    </button>
                    <button
                        title="Paste code in file"
                        onClick={pasteCodeInFile}
                        className="rounded-lg border border-blue-300/25 bg-slate-900/70 p-2 transition hover:bg-blue-500/20"
                    >
                        <LuClipboardPaste
                            size={18}
                            className="cursor-pointer text-slate-100"
                        />
                    </button>
                </div>
            )}
            <div className="h-full w-full overflow-y-auto rounded-xl border border-blue-300/25 bg-slate-900/75 p-2">
                <ReactMarkdown
                    components={{
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        code({ inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "")
                            const language = match ? match[1] : "javascript" // Default to JS

                            return !inline ? (
                                <SyntaxHighlighter
                                    style={dracula}
                                    language={language}
                                    PreTag="pre"
                                    className="!m-0 !h-full !rounded-lg !bg-gray-900 !p-2"
                                >
                                    {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            )
                        },
                        pre({ children }) {
                            return <pre className="h-full">{children}</pre>
                        },
                    }}
                >
                    {output}
                </ReactMarkdown>
            </div>

            <ConfirmModal
                isOpen={isReplaceModalOpen}
                title="Replace File Content"
                message="Replace current file content with generated code?"
                confirmText="Replace"
                onConfirm={replaceCodeInFile}
                onClose={() => setReplaceModalOpen(false)}
            />
        </motion.div>
    )
}

export default CopilotView
