import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { v4 as uuidv4 } from "uuid"
import {
    HiOutlinePlus,
    HiOutlineCode,
    HiOutlineDesktopComputer,
    HiOutlineUsers,
} from "react-icons/hi"
import { useAuth } from "@/context/AuthContext"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"

const PROJECT_PRESETS = [
    {
        title: "Blank Canvas Project",
        template: "blank",
        description: "Fresh empty coding workspace ready for any language and problem solving.",
        icon: HiOutlineCode,
        tags: ["Any Language", "Full Control"],
    },
    {
        title: "Frontend Playground",
        template: "frontend",
        description: "HTML, CSS, and JavaScript starter environment with live preview capabilities.",
        icon: HiOutlineDesktopComputer,
        tags: ["HTML", "CSS", "JS"],
    },
    {
        title: "Technical Interview Room",
        template: "interview",
        description: "Pair programming setup with preloaded problem statement and shared run outputs.",
        icon: HiOutlineUsers,
        tags: ["Interviews", "DSA", "Pairing"],
    },
]

const ProjectsPage = () => {
    const { user } = useAuth()
    const { setCurrentUser, setStatus } = useAppContext()
    const { socket } = useSocket()
    const navigate = useNavigate()

    const launchPreset = (template) => {
        const roomId = uuidv4()
        const username = user?.username || "Developer"

        setStatus(USER_STATUS.ATTEMPTING_JOIN)
        const joinPayload = {
            username,
            roomId,
            template,
        }
        setCurrentUser(joinPayload)
        socket.emit(SocketEvent.JOIN_REQUEST, joinPayload)

        navigate(`/editor/${roomId}`, {
            state: { username },
        })
    }

    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(56,131,255,0.2),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(58,191,177,0.16),transparent_40%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Projects & Templates
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Launch collaborative workspace templates in seconds
                        </p>
                    </div>

                    <button
                        onClick={() => launchPreset("blank")}
                        className="btn-primary flex items-center gap-2 self-start sm:self-auto text-sm"
                    >
                        <HiOutlinePlus className="text-lg" />
                        New Blank Project
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {PROJECT_PRESETS.map((project, idx) => {
                        const Icon = project.icon
                        return (
                            <motion.div
                                key={project.title}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: idx * 0.1 }}
                                className="glass-panel flex flex-col justify-between p-6 transition-all hover:border-blue-400/50 hover:shadow-[0_15px_30px_rgba(46,168,255,0.15)]"
                            >
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-xl bg-blue-500/10 p-3 text-cyan-400">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <h2 className="text-lg font-bold text-white">
                                            {project.title}
                                        </h2>
                                    </div>

                                    <p className="mt-3 text-sm text-slate-300">
                                        {project.description}
                                    </p>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {project.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-md border border-slate-700/60 bg-slate-800/40 px-2 py-0.5 text-xs text-slate-300"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => launchPreset(project.template)}
                                    className="btn-primary mt-6 w-full py-2.5 text-sm font-semibold"
                                >
                                    Launch Workspace
                                </button>
                            </motion.div>
                        )
                    })}
                </div>
            </main>

            <Footer />
        </div>
    )
}

export default ProjectsPage
