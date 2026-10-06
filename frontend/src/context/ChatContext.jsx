import { SocketEvent } from "@/types/socket"
import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react"
import { useSocket } from "./SocketContext"

const ChatContext = createContext(null)

export const useChatRoom = () => {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error("useChatRoom must be used within a ChatContextProvider")
    }
    return context
}

function ChatContextProvider({ children }) {
    const { socket } = useSocket()
    const [messages, setMessages] = useState([])
    const [isNewMessage, setIsNewMessage] = useState(false)
    const [lastScrollHeight, setLastScrollHeight] = useState(0)
    const [pinnedNote, setPinnedNote] = useState(null)

    useEffect(() => {
        socket.on(
            SocketEvent.RECEIVE_MESSAGE,
            ({ message }) => {
                setMessages((messages) => [...messages, message])
                setIsNewMessage(true)
            },
        )

        socket.on(SocketEvent.PINNED_NOTE_SET, ({ note }) => {
            setPinnedNote(note)
        })

        socket.on(SocketEvent.PINNED_NOTE_CLEARED, () => {
            setPinnedNote(null)
        })

        return () => {
            socket.off(SocketEvent.RECEIVE_MESSAGE)
            socket.off(SocketEvent.PINNED_NOTE_SET)
            socket.off(SocketEvent.PINNED_NOTE_CLEARED)
        }
    }, [socket])

    return (
        <ChatContext.Provider
            value={{
                messages,
                setMessages,
                isNewMessage,
                setIsNewMessage,
                lastScrollHeight,
                setLastScrollHeight,
                pinnedNote,
                setPinnedNote,
            }}
        >
            {children}
        </ChatContext.Provider>
    )
}

export { ChatContextProvider }
export default ChatContext
