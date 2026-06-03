interface ChatMessage {
    id: string
    message: string
    username: string
    timestamp: string
}

interface PinnedNote {
    text: string
    updatedBy: string
    updatedAt: string
}

interface ChatContext {
    messages: ChatMessage[]
    setMessages: (
        messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[]),
    ) => void
    isNewMessage: boolean
    setIsNewMessage: (isNewMessage: boolean) => void
    lastScrollHeight: number
    setLastScrollHeight: (lastScrollHeight: number) => void
    pinnedNote: PinnedNote | null
    setPinnedNote: (note: PinnedNote | null) => void
}

export { ChatContext, ChatMessage, PinnedNote }
