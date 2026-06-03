import ChatInput from "@/components/chats/ChatInput"
import ChatList from "@/components/chats/ChatList"
import { useChatRoom } from "@/context/ChatContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { SocketEvent } from "@/types/socket"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

const ChatsView = () => {
    const { viewHeight } = useResponsive()
    const { socket } = useSocket()
    const { pinnedNote } = useChatRoom()
    const [noteInput, setNoteInput] = useState("")

    useEffect(() => {
        setNoteInput(pinnedNote?.text || "")
    }, [pinnedNote?.text])

    const handleSavePinnedNote = () => {
        const text = noteInput.trim()
        if (!text) return

        socket.emit(SocketEvent.PINNED_NOTE_SET, {
            note: { text },
        })
    }

    const handleClearPinnedNote = () => {
        socket.emit(SocketEvent.PINNED_NOTE_CLEARED)
        setNoteInput("")
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex max-h-full min-h-[400px] w-full flex-col gap-2 p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">Group Chat</h1>

            <div className="rounded-xl border border-blue-300/25 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                    Room Note
                </p>
                <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Pin key decisions or TODOs for this room..."
                    className="mt-2 min-h-[74px] w-full resize-none rounded-lg border border-blue-300/25 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                        {pinnedNote
                            ? `Updated by ${pinnedNote.updatedBy}`
                            : "No pinned note yet"}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleClearPinnedNote}
                            className="rounded-md border border-blue-300/25 px-2.5 py-1 text-slate-200 hover:bg-blue-500/20"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleSavePinnedNote}
                            className="rounded-md bg-blue-500 px-2.5 py-1 text-white hover:bg-blue-400"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat list */}
            <ChatList />
            {/* Chat input */}
            <ChatInput />
        </motion.div>
    )
}

export default ChatsView
