import { useAppContext } from "@/context/AppContext"
import { useChatRoom } from "@/context/ChatContext"
import { SyntheticEvent, useEffect, useRef } from "react"

function ChatList() {
    const {
        messages,
        isNewMessage,
        setIsNewMessage,
        lastScrollHeight,
        setLastScrollHeight,
    } = useChatRoom()
    const { currentUser, users } = useAppContext()
    const messagesContainerRef = useRef<HTMLDivElement | null>(null)
    const typingUsers = users.filter(
        (user) => user.username !== currentUser.username && user.typing,
    )

    const handleScroll = (e: SyntheticEvent) => {
        const container = e.target as HTMLDivElement
        setLastScrollHeight(container.scrollTop)
    }

    // Scroll to bottom when messages change
    useEffect(() => {
        if (!messagesContainerRef.current) return
        messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight
    }, [messages])

    useEffect(() => {
        if (isNewMessage) {
            setIsNewMessage(false)
        }
        if (messagesContainerRef.current)
            messagesContainerRef.current.scrollTop = lastScrollHeight
    }, [isNewMessage, setIsNewMessage, lastScrollHeight])

    return (
        <div
            className="flex-grow overflow-auto rounded-xl border border-blue-300/25 bg-slate-900/75 p-3"
            ref={messagesContainerRef}
            onScroll={handleScroll}
        >
            {/* Chat messages */}
            {messages.map((message, index) => {
                return (
                    <div
                        key={index}
                        className={
                            "mb-2 w-[82%] self-end break-words rounded-xl border border-blue-300/20 bg-slate-950/80 px-3 py-2" +
                            (message.username === currentUser.username
                                ? " ml-auto "
                                : "")
                        }
                    >
                        <div className="flex justify-between">
                            <span className="text-xs text-cyan-300">
                                {message.username}
                            </span>
                            <span className="text-xs text-slate-300">
                                {message.timestamp}
                            </span>
                        </div>
                        <p className="py-1 text-slate-100">{message.message}</p>
                    </div>
                )
            })}
            {typingUsers.length > 0 && (
                <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                    {typingUsers.length === 1
                        ? `${typingUsers[0].username} is typing...`
                        : `${typingUsers[0].username} and ${typingUsers.length - 1} more are typing...`}
                </div>
            )}
        </div>
    )
}

export default ChatList
