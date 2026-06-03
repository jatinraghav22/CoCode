import FormComponent from "@/components/forms/FormComponent"
import Footer from "@/components/common/Footer"
import { motion } from "framer-motion"

function HomePage() {
    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(56,131,255,0.23),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(58,191,177,0.18),transparent_40%)]" />

            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-10 px-4 py-10 md:flex-row md:gap-16">
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="glass-panel w-full max-w-xl p-8"
                >
                    <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                        Real-time collaboration
                    </p>
                    <h1 className="mt-3 text-4xl font-black leading-tight text-slate-100 md:text-5xl">
                        CoCode
                    </h1>
                    <p className="mt-5 text-base leading-7 text-slate-300">
                        Write code together, run instantly, and switch to shared
                        drawing without leaving your room. Built for fast teams,
                        pair sessions, and technical interviews.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-200">
                        <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1">
                            Live Cursors
                        </span>
                        <span className="rounded-full border border-blue-300/40 bg-blue-400/10 px-3 py-1">
                            Multi-language
                        </span>
                        <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1">
                            Shared Run Output
                        </span>
                    </div>
                </motion.section>

                <div className="flex w-full items-center justify-center md:w-[480px]">
                    <FormComponent />
                </div>
            </div>

            <Footer />
        </div>
    )
}

export default HomePage
