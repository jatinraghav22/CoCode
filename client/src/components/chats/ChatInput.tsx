import { useAppContext } from "@/context/AppContext"
import { useChatRoom } from "@/context/ChatContext"
import { useSocket } from "@/context/SocketContext"
import { ChatMessage } from "@/types/chat"
import { SocketEvent } from "@/types/socket"
import { formatDate } from "@/utils/formateDate"
import { FormEvent, useEffect, useRef } from "react"
import { LuSendHorizonal } from "react-icons/lu"
import { v4 as uuidV4 } from "uuid"

function ChatInput() {
    const { currentUser } = useAppContext()
    const { socket } = useSocket()
    const { setMessages } = useChatRoom()
    const inputRef = useRef<HTMLInputElement | null>(null)
    const typingTimerRef = useRef<number | null>(null)

    const clearTypingTimer = () => {
        if (typingTimerRef.current !== null) {
            window.clearTimeout(typingTimerRef.current)
            typingTimerRef.current = null
        }
    }

    const signalTyping = () => {
        socket.emit(SocketEvent.TYPING_START, { cursorPosition: 0 })
        clearTypingTimer()
        typingTimerRef.current = window.setTimeout(() => {
            socket.emit(SocketEvent.TYPING_PAUSE)
            typingTimerRef.current = null
        }, 900)
    }

    const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const inputVal = inputRef.current?.value.trim()

        if (inputVal && inputVal.length > 0) {
            const message: ChatMessage = {
                id: uuidV4(),
                message: inputVal,
                username: currentUser.username,
                timestamp: formatDate(new Date().toISOString()),
            }
            socket.emit(SocketEvent.SEND_MESSAGE, { message })
            setMessages((messages) => [...messages, message])
            socket.emit(SocketEvent.TYPING_PAUSE)
            clearTypingTimer()

            if (inputRef.current) inputRef.current.value = ""
        }
    }

    useEffect(() => {
        return () => {
            clearTypingTimer()
            socket.emit(SocketEvent.TYPING_PAUSE)
        }
    }, [socket])

    return (
        <form
            onSubmit={handleSendMessage}
            className="flex justify-between rounded-xl border border-blue-300/35 bg-slate-900/75 p-1"
        >
            <input
                type="text"
                className="w-full flex-grow rounded-lg border-none bg-transparent px-3 py-2 text-slate-100 outline-none"
                placeholder="Enter a message..."
                ref={inputRef}
                onChange={signalTyping}
                onBlur={() => {
                    socket.emit(SocketEvent.TYPING_PAUSE)
                    clearTypingTimer()
                }}
            />
            <button
                className="flex items-center justify-center rounded-lg bg-blue-500 px-3 text-white transition hover:bg-blue-400"
                type="submit"
            >
                <LuSendHorizonal size={24} />
            </button>
        </form>
    )
}

export default ChatInput
