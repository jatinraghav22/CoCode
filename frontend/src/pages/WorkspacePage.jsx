import { motion } from "framer-motion"
import FormComponent from "@/components/forms/FormComponent"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"
import { useAuth } from "@/context/AuthContext"
import { HiOutlineCode, HiOutlineSparkles, HiOutlineTerminal } from "react-icons/hi"

const WorkspacePage = () => {
    const { user } = useAuth()

    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(56,131,255,0.23),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(58,191,177,0.18),transparent_40%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-10 px-4 py-10 md:flex-row md:gap-16">
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="glass-panel w-full max-w-xl p-8"
                >
                    <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                        Workspace Session
                    </p>
                    <h1 className="mt-3 text-4xl font-black leading-tight text-slate-100 md:text-5xl">
                        CoCode Workspaces
                    </h1>
                    <p className="mt-5 text-base leading-7 text-slate-300">
                        Launch a new coding room or join an ongoing team session.
                        Everything is synced in real-time across all connected peers with live cursors, shared code execution, and drawing canvas.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-200">
                        <span className="flex items-center gap-1.5 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3.5 py-1 text-cyan-200">
                            <HiOutlineSparkles className="h-4 w-4" /> Live Cursors
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full border border-blue-300/40 bg-blue-400/10 px-3.5 py-1 text-blue-200">
                            <HiOutlineTerminal className="h-4 w-4" /> Shared Execution
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3.5 py-1 text-emerald-200">
                            <HiOutlineCode className="h-4 w-4" /> 50+ Languages
                        </span>
                    </div>

                    {user && (
                        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
                            Joined as <strong className="text-cyan-300">{user.username}</strong> ({user.name})
                        </div>
                    )}
                </motion.section>

                <div className="flex w-full items-center justify-center md:w-[480px]">
                    <FormComponent />
                </div>
            </main>

            <Footer />
        </div>
    )
}

export default WorkspacePage
