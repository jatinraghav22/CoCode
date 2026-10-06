import Users from "@/components/common/Users"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useResponsive from "@/hooks/useResponsive"
import { USER_STATUS } from "@/types/user"
import toast from "react-hot-toast"
import { GoSignOut } from "react-icons/go"
import { IoShareOutline } from "react-icons/io5"
import { LuCopy } from "react-icons/lu"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"

function UsersView() {
    const navigate = useNavigate()
    const { viewHeight } = useResponsive()
    const { users, setStatus, setCurrentUser } = useAppContext()
    const { socket } = useSocket()

    const onlineUsers = users.filter((user) => user.status === "online").length
    const typingUsers = users.filter((user) => user.typing).length
    const editingUsers = users.filter((user) =>
        Boolean(user.currentFile),
    ).length

    const copyURL = async () => {
        const url = window.location.href
        try {
            await navigator.clipboard.writeText(url)
            toast.success("URL copied to clipboard")
        } catch (error) {
            toast.error("Unable to copy URL to clipboard")
            console.log(error)
        }
    }

    const shareURL = async () => {
        const url = window.location.href
        try {
            await navigator.share({ url })
        } catch (error) {
            toast.error("Unable to share URL")
            console.log(error)
        }
    }

    const leaveRoom = () => {
        socket.disconnect()
        setCurrentUser({ username: "", roomId: "" })
        setStatus(USER_STATUS.DISCONNECTED)
        navigate("/", {
            replace: true,
        })
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col p-4"
            style={{ height: viewHeight }}
        >
            <h1 className="view-title">Users</h1>
            <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-blue-300/20 bg-slate-900/70 px-2 py-1.5 text-center">
                    <p className="text-[11px] text-slate-400">Online</p>
                    <p className="text-sm text-cyan-200">{onlineUsers}</p>
                </div>
                <div className="rounded-lg border border-blue-300/20 bg-slate-900/70 px-2 py-1.5 text-center">
                    <p className="text-[11px] text-slate-400">Typing</p>
                    <p className="text-sm text-cyan-200">{typingUsers}</p>
                </div>
                <div className="rounded-lg border border-blue-300/20 bg-slate-900/70 px-2 py-1.5 text-center">
                    <p className="text-[11px] text-slate-400">Editing</p>
                    <p className="text-sm text-cyan-200">{editingUsers}</p>
                </div>
            </div>
            {/* List of connected users */}
            <Users />
            <div className="flex flex-col items-center gap-4 pt-4">
                <div className="flex w-full gap-4">
                    {/* Share URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-xl border border-blue-300/30 bg-slate-900/75 p-3 text-slate-100 transition hover:bg-blue-500/20"
                        onClick={shareURL}
                        title="Share Link"
                    >
                        <IoShareOutline size={26} />
                    </button>
                    {/* Copy URL button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-xl border border-blue-300/30 bg-slate-900/75 p-3 text-slate-100 transition hover:bg-blue-500/20"
                        onClick={copyURL}
                        title="Copy Link"
                    >
                        <LuCopy size={22} />
                    </button>
                    {/* Leave room button */}
                    <button
                        className="flex flex-grow items-center justify-center rounded-xl bg-blue-500 p-3 text-white transition hover:bg-blue-400"
                        onClick={leaveRoom}
                        title="Leave room"
                    >
                        <GoSignOut size={22} />
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

export default UsersView
