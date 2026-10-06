import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { v4 as uuidv4 } from "uuid"
import {
    HiOutlinePlus,
    HiOutlineTerminal,
    HiOutlineCode,
    HiOutlineUsers,
    HiOutlineSparkles,
    HiOutlineArrowLeft,
} from "react-icons/hi"
import { useAuth } from "@/context/AuthContext"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"

const TEMPLATES = [
    {
        id: "blank",
        title: "Blank Canvas",
        description: "Empty workspace ready for any language and problem solving.",
        icon: HiOutlineCode,
    },
    {
        id: "frontend",
        title: "Frontend Starter",
        description: "Pre-configured React, HTML, and CSS sandbox structure.",
        icon: HiOutlineTerminal,
    },
    {
        id: "interview",
        title: "Technical Interview",
        description: "Interview problem statement, solution template, and notes.",
        icon: HiOutlineUsers,
    },
]

const CreateRoomPage = () => {
    const { user } = useAuth()
    const { setCurrentUser, setStatus } = useAppContext()
    const { socket } = useSocket()
    const navigate = useNavigate()

    const [roomId, setRoomId] = useState(() => uuidv4())
    const [selectedTemplate, setSelectedTemplate] = useState("blank")

    const handleCreate = (e) => {
        e?.preventDefault()
        const cleanRoomId = roomId.trim()
        if (!cleanRoomId || cleanRoomId.length < 5) {
            toast.error("Room ID must be at least 5 characters")
            return
        }

        const username = user?.username || "Guest"
        setStatus(USER_STATUS.ATTEMPTING_JOIN)

        const joinPayload = {
            username,
            roomId: cleanRoomId,
            template: selectedTemplate,
        }

        setCurrentUser(joinPayload)
        if (socket) {
            socket.emit(SocketEvent.JOIN_REQUEST, joinPayload)
        }

        toast.success("Created collaborative room!")
        navigate(`/room/${cleanRoomId}`, {
            state: { username },
        })
    }

    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(56,131,255,0.2),transparent_40%),radial-gradient(circle_at_85%_75%,rgba(58,191,177,0.18),transparent_40%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="glass-panel w-full p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-blue-500/20"
                >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                                <HiOutlinePlus className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-100">
                                    Create Collaborative Room
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Invite peers to code, chat, and draw together in real-time
                                </p>
                            </div>
                        </div>

                        <Link
                            to="/compiler"
                            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        >
                            <HiOutlineArrowLeft />
                            Personal Compiler
                        </Link>
                    </div>

                    <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-6">
                        {/* Template Selection */}
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                                Choose Starter Template
                            </label>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {TEMPLATES.map((tmpl) => {
                                    const Icon = tmpl.icon
                                    const isSelected = selectedTemplate === tmpl.id
                                    return (
                                        <div
                                            key={tmpl.id}
                                            onClick={() => setSelectedTemplate(tmpl.id)}
                                            className={`cursor-pointer rounded-2xl border p-4 transition ${
                                                isSelected
                                                    ? "border-cyan-400 bg-blue-500/20 shadow-[0_0_15px_rgba(56,131,255,0.2)]"
                                                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon
                                                    className={`h-5 w-5 ${
                                                        isSelected ? "text-cyan-300" : "text-slate-400"
                                                    }`}
                                                />
                                                <h3 className="text-sm font-bold text-slate-100">
                                                    {tmpl.title}
                                                </h3>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-400">
                                                {tmpl.description}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Room ID */}
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                                Room Identifier (Shareable ID)
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    placeholder="Enter unique Room ID"
                                    className="input-modern flex-1 text-sm font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newId = uuidv4()
                                        setRoomId(newId)
                                        toast.success("Generated new Room ID")
                                    }}
                                    className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
                                >
                                    Generate ID
                                </button>
                            </div>
                            <p className="mt-1.5 text-[11px] text-slate-500">
                                Anyone with this Room ID can join your collaborative session.
                            </p>
                        </div>

                        {/* Submit */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-800/80 pt-5">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <HiOutlineSparkles className="text-cyan-400 text-sm" />
                                <span>
                                    Hosting as <strong className="text-slate-200">@{user?.username}</strong>
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <Link
                                    to="/join-room"
                                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
                                >
                                    Join Existing Room
                                </Link>

                                <button
                                    type="submit"
                                    className="btn-primary px-6 py-2.5 text-xs font-bold shadow-[0_0_20px_rgba(46,168,255,0.3)]"
                                >
                                    Create Room & Enter
                                </button>
                            </div>
                        </div>
                    </form>
                </motion.div>
            </main>

            <Footer />
        </div>
    )
}

export default CreateRoomPage
