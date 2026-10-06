import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import {
    HiOutlineLogin,
    HiOutlineTerminal,
    HiOutlineArrowLeft,
    HiOutlineSparkles,
} from "react-icons/hi"
import { useAuth } from "@/context/AuthContext"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"

const JoinRoomPage = () => {
    const { user } = useAuth()
    const { setCurrentUser, setStatus } = useAppContext()
    const { socket } = useSocket()
    const navigate = useNavigate()

    const [roomId, setRoomId] = useState("")
    const [isJoining, setIsJoining] = useState(false)

    const handleJoin = (e) => {
        e.preventDefault()
        const cleanRoomId = roomId.trim()

        if (!cleanRoomId) {
            toast.error("Please enter a Room ID")
            return
        }

        if (cleanRoomId.length < 5) {
            toast.error("Room ID must be at least 5 characters long")
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
        if (socket) {
            socket.emit(SocketEvent.JOIN_REQUEST, joinPayload)
        }

        toast.loading("Connecting to room...")
        navigate(`/room/${cleanRoomId}`, {
            state: { username },
        })
    }

    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(56,131,255,0.2),transparent_40%),radial-gradient(circle_at_85%_75%,rgba(58,191,177,0.18),transparent_40%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="glass-panel w-full p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-blue-500/20"
                >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                <HiOutlineTerminal className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-100">
                                    Join Collaborative Room
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Paste a Room ID to collaborate with peers
                                </p>
                            </div>
                        </div>

                        <Link
                            to="/compiler"
                            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        >
                            <HiOutlineArrowLeft />
                            Compiler
                        </Link>
                    </div>

                    <form onSubmit={handleJoin} className="mt-6 flex flex-col gap-5">
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                                Room ID
                            </label>
                            <input
                                type="text"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                placeholder="e.g. 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
                                className="input-modern w-full font-mono text-sm"
                                autoFocus
                            />
                        </div>

                        {user && (
                            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
                                <HiOutlineSparkles className="text-cyan-400 text-sm" />
                                <span>
                                    Joining room as <strong className="text-slate-200">@{user.username}</strong>
                                </span>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isJoining}
                                className="btn-primary flex items-center justify-center gap-2 py-3 text-sm font-bold shadow-[0_0_20px_rgba(46,168,255,0.3)]"
                            >
                                <HiOutlineLogin className="text-lg" />
                                {isJoining ? "Joining..." : "Join Room"}
                            </button>

                            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                                <span>Don't have a room?</span>
                                <Link
                                    to="/create-room"
                                    className="font-semibold text-cyan-300 transition hover:text-cyan-200 hover:underline"
                                >
                                    Create a new room
                                </Link>
                            </div>
                        </div>
                    </form>
                </motion.div>
            </main>

            <Footer />
        </div>
    )
}

export default JoinRoomPage
