import { FormEvent, ReactNode, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

interface BaseModalProps {
    isOpen: boolean
    title: string
    message?: string
    onClose: () => void
    children?: ReactNode
}

function BaseModal({
    isOpen,
    title,
    message,
    onClose,
    children,
}: BaseModalProps) {
    useEffect(() => {
        if (!isOpen) return

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }

        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                onMouseDown={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-full max-w-md rounded-2xl border border-blue-500/40 bg-slate-900/90 p-5 shadow-[0_30px_80px_rgba(2,10,24,0.75)]"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <h2 className="text-lg font-semibold text-white">
                        {title}
                    </h2>
                    {message ? (
                        <p className="mt-2 text-sm leading-6 text-blue-100">
                            {message}
                        </p>
                    ) : null}
                    <div className="mt-4">{children}</div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

interface ConfirmModalProps {
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onClose: () => void
}

function ConfirmModal({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onClose,
}: ConfirmModalProps) {
    return (
        <BaseModal
            isOpen={isOpen}
            title={title}
            message={message}
            onClose={onClose}
        >
            <div className="flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="rounded-md border border-blue-500/70 px-4 py-2 text-sm text-blue-100 transition hover:bg-blue-900"
                >
                    {cancelText}
                </button>
                <button
                    onClick={onConfirm}
                    className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
                >
                    {confirmText}
                </button>
            </div>
        </BaseModal>
    )
}

interface PromptModalProps {
    isOpen: boolean
    title: string
    message: string
    placeholder: string
    initialValue?: string
    submitText?: string
    cancelText?: string
    onSubmit: (value: string) => void
    onClose: () => void
}

function PromptModal({
    isOpen,
    title,
    message,
    placeholder,
    initialValue = "",
    submitText = "Create",
    cancelText = "Cancel",
    onSubmit,
    onClose,
}: PromptModalProps) {
    const [value, setValue] = useState(initialValue)
    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (!isOpen) return
        setValue(initialValue)
    }, [initialValue, isOpen])

    useEffect(() => {
        if (!isOpen) return
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [isOpen])

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const trimmedValue = value.trim()
        if (!trimmedValue) return
        onSubmit(trimmedValue)
    }

    return (
        <BaseModal
            isOpen={isOpen}
            title={title}
            message={message}
            onClose={onClose}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-md border border-blue-500/60 bg-blue-900/50 px-3 py-2 text-white outline-none focus:border-blue-400"
                />
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-blue-500/70 px-4 py-2 text-sm text-blue-100 transition hover:bg-blue-900"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="submit"
                        className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                        {submitText}
                    </button>
                </div>
            </form>
        </BaseModal>
    )
}

export { ConfirmModal, PromptModal }
