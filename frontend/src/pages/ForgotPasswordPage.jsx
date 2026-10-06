import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { HiOutlineKey, HiOutlineArrowLeft, HiOutlineInformationCircle } from "react-icons/hi"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"

const ForgotPasswordPage = () => {
    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,131,255,0.2),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(58,191,177,0.16),transparent_45%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="glass-panel w-full max-w-md p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-blue-500/20 text-center"
                >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 shadow-[0_0_25px_rgba(56,131,255,0.3)]">
                        <HiOutlineKey className="h-8 w-8" />
                    </div>

                    <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        Forgot Password
                    </h1>

                    <p className="mt-2 text-sm text-slate-300">
                        Password recovery & email reset service
                    </p>

                    <div className="my-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left text-sm text-amber-200">
                        <div className="flex items-start gap-3">
                            <HiOutlineInformationCircle className="h-6 w-6 shrink-0 text-amber-400 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-300">
                                    Feature Coming Soon
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-amber-200/90">
                                    Automated email password resets are currently in development. If you need account recovery or password assistance, please register a new developer account or contact your CoCode room admin.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Link
                            to="/login"
                            className="btn-primary flex items-center justify-center gap-2 py-2.5 text-sm font-semibold"
                        >
                            <HiOutlineArrowLeft className="h-4 w-4" />
                            Back to Login
                        </Link>
                        <Link
                            to="/register"
                            className="rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        >
                            Create a New Account
                        </Link>
                    </div>
                </motion.div>
            </main>

            <Footer />
        </div>
    )
}

export default ForgotPasswordPage
