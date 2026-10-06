import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { v4 as uuidv4 } from "uuid"
import {
    HiOutlinePlus,
    HiOutlineLogin,
    HiOutlineTerminal,
    HiOutlineSparkles,
    HiOutlineClock,
} from "react-icons/hi"
import { useAuth } from "@/context/AuthContext"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"
import Select from "@/components/common/Select"

const ROOM_TEMPLATES = ["blank", "frontend", "interview"]

const DashboardPage = () => {
    const { user } = useAuth()
    const { setCurrentUser, setStatus } = useAppContext()
    const { socket } = useSocket()
    const navigate = useNavigate()

    const [roomId, setRoomId] = useState("")
    const [template, setTemplate] = useState("blank")
    const [isJoining, setIsJoining] = useState(false)

    const handleCreateRoom = () => {
        const newRoomId = uuidv4()
        const username = user?.username || "Guest"

        setStatus(USER_STATUS.ATTEMPTING_JOIN)
        const joinPayload = {
            username,
            roomId: newRoomId,
            template,
        }
        setCurrentUser(joinPayload)
        socket.emit(SocketEvent.JOIN_REQUEST, joinPayload)

        toast.success("Created new workspace room!")
        navigate(`/editor/${newRoomId}`, {
            state: { username },
        })
    }

    const handleJoinRoom = (e) => {
        e.preventDefault()
        const cleanRoomId = roomId.trim()

        if (!cleanRoomId) {
            toast.error("Please enter a Room ID")
            return
        }

        if (cleanRoomId.length < 5) {
            toast.error("Room ID must be at least 5 characters")
            return
        }

        setIsJoining(true)
        const username = user?.username || "Guest"

        setStatus(USER_STATUS.ATTEMPTING_JOIN)
        const joinPayload = {
            username,
            roomId: cleanRoomId,
        }
        setCurrentUser(joinPayload)
        socket.emit(SocketEvent.JOIN_REQUEST, joinPayload)

        toast.loading("Connecting to workspace...")
        navigate(`/editor/${cleanRoomId}`, {
            state: { username },
        })
    }

    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(56,131,255,0.22),transparent_40%),radial-gradient(circle_at_85%_75%,rgba(58,191,177,0.18),transparent_40%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                {/* Hero Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="glass-panel relative overflow-hidden p-6 sm:p-8 border-blue-500/30"
                >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            {user?.avatar ? (
                                <img
                                    src={user.avatar}
                                    alt={user.username}
                                    className="h-16 w-16 rounded-2xl border-2 border-cyan-400/40 bg-slate-900 object-cover shadow-[0_0_25px_rgba(56,131,255,0.3)]"
                                />
                            ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/30 text-2xl font-black text-cyan-300">
                                    {user?.username?.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                        Welcome, {user?.name || user?.username}!
                                    </h1>
                                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                                        Online
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-300">
                                    @{user?.username} • Ready for real-time collaborative coding
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCreateRoom}
                                className="btn-primary flex items-center gap-2 shadow-[0_0_20px_rgba(46,168,255,0.3)]"
                            >
                                <HiOutlinePlus className="text-lg" />
                                Instant Workspace
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Main Grid: Create / Join & Stats */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    {/* Left: Join or Create Room Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.1 }}
                        className="glass-panel flex flex-col justify-between p-6 sm:p-7 lg:col-span-7"
                    >
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="rounded-lg bg-blue-500/10 p-2 text-cyan-400">
                                    <HiOutlineTerminal className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-100">
                                        Enter Collaboration Workspace
                                    </h2>
                                    <p className="text-xs text-slate-400">
                                        Connect with collaborators in real time
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleJoinRoom} className="mt-6 flex flex-col gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
                                        Starter Template
                                    </label>
                                    <Select
                                        value={template}
                                        options={ROOM_TEMPLATES}
                                        title="Select Starter Template"
                                        onChange={(e) =>
                                            setTemplate(e.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
                                        Room ID
                                    </label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <input
                                            type="text"
                                            value={roomId}
                                            onChange={(e) => setRoomId(e.target.value)}
                                            placeholder="Paste Room ID or generate one"
                                            className="input-modern flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const id = uuidv4()
                                                setRoomId(id)
                                                toast.success("Generated new Room ID!")
                                            }}
                                            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 whitespace-nowrap"
                                        >
                                            Generate ID
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <button
                                        type="submit"
                                        disabled={isJoining}
                                        className="btn-primary flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                                    >
                                        <HiOutlineLogin className="text-lg" />
                                        {isJoining ? "Connecting..." : "Join Workspace"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleCreateRoom}
                                        className="rounded-xl border border-slate-700 bg-slate-900/80 py-3 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-slate-800"
                                    >
                                        Create New Room
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="mt-6 border-t border-slate-800/80 pt-4 text-xs text-slate-400 flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                            <span>
                                Logged in as <strong className="text-slate-200">{user?.username}</strong> ({user?.email})
                            </span>
                        </div>
                    </motion.div>

                    {/* Right: Quick Features / Platform Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.2 }}
                        className="flex flex-col gap-4 lg:col-span-5"
                    >
                        <div className="glass-panel p-5">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400">
                                    <HiOutlineSparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Live Features</h3>
                                    <p className="text-xs text-slate-400">Instant multi-user tools</p>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                                    <p className="font-semibold text-cyan-300">Live Code</p>
                                    <p className="mt-0.5 text-slate-400">Simultaneous editing & cursors</p>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                                    <p className="font-semibold text-teal-300">Whiteboard</p>
                                    <p className="mt-0.5 text-slate-400">Shared visual drawing canvas</p>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                                    <p className="font-semibold text-blue-300">Run Code</p>
                                    <p className="mt-0.5 text-slate-400">Judge0 & Piston multi-lang engine</p>
                                </div>
                                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                                    <p className="font-semibold text-emerald-300">Live Chat</p>
                                    <p className="mt-0.5 text-slate-400">Real-time room chat & notes</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-5">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
                                    <HiOutlineClock className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Account Info</h3>
                                    <p className="text-xs text-slate-400">Verified session</p>
                                </div>
                            </div>
                            <div className="mt-4 space-y-2 text-xs text-slate-300">
                                <div className="flex justify-between py-1 border-b border-slate-800/80">
                                    <span className="text-slate-400">Account ID:</span>
                                    <span className="font-mono text-cyan-300">{user?.id}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-800/80">
                                    <span className="text-slate-400">Joined:</span>
                                    <span>
                                        {user?.createdAt
                                            ? new Date(user.createdAt).toLocaleDateString()
                                            : "Recent"}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-slate-400">Role:</span>
                                    <span className="text-emerald-400 font-semibold">Active Developer</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>

            <Footer />
        </div>
    )
}

export default DashboardPage
