import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi"
import { useAuth } from "@/context/AuthContext"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"

const LoginPage = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { login } = useAuth()

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        rememberMe: false,
    })

    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState(null)

    // Check if redirected from register or protected route
    const fromPath = location.state?.from
    const redirectUrl = fromPath ? `${fromPath.pathname}${fromPath.search || ""}` : "/compiler"

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }))
        if (errorMessage) {
            setErrorMessage(null)
        }
    }

    const validateForm = () => {
        const trimmed = formData.email.trim()

        if (!trimmed) {
            setErrorMessage("Please enter your email address or username")
            return false
        }

        if (!formData.password) {
            setErrorMessage("Password is required")
            return false
        }

        return true
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (isLoading) return

        if (!validateForm()) {
            return
        }

        setIsLoading(true)
        setErrorMessage(null)

        try {
            const result = await login({
                email: formData.email.trim(),
                password: formData.password,
                rememberMe: formData.rememberMe,
            })

            if (result.success) {
                toast.success("Logged in successfully!")
                navigate(redirectUrl, { replace: true })
            } else {
                setErrorMessage(result.error || "Invalid email or password")
            }
        } catch {
            setErrorMessage("Unable to connect to the server. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,131,255,0.2),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(58,191,177,0.16),transparent_45%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="glass-panel w-full max-w-md p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-blue-500/20"
                >
                    {/* Header */}
                    <div className="mb-6 flex flex-col items-center text-center">
                        <img
                            src="/icon.png"
                            alt="CoCode Logo"
                            className="h-12 w-12 rounded-xl shadow-[0_0_20px_rgba(56,131,255,0.4)]"
                        />
                        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                            Welcome back
                        </h1>
                        <p className="mt-1.5 text-sm text-slate-400">
                            Log in to your CoCode collaborative workspace
                        </p>
                    </div>

                    {/* Error Banner */}
                    {errorMessage && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300"
                            role="alert"
                        >
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                                {errorMessage}
                            </p>
                        </motion.div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
                        {/* Email or Username */}
                        <div>
                            <label
                                htmlFor="login-email"
                                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
                            >
                                Email Address or Username
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <HiOutlineMail className="h-5 w-5" />
                                </div>
                                <input
                                    id="login-email"
                                    type="text"
                                    name="email"
                                    placeholder="developer@example.com or username"
                                    autoComplete="username"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    className="input-modern pl-10"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label
                                    htmlFor="login-password"
                                    className="block text-xs font-medium uppercase tracking-wider text-slate-400"
                                >
                                    Password
                                </label>
                                <Link
                                    to="/forgot-password"
                                    className="text-xs font-medium text-cyan-400 transition hover:text-cyan-300 hover:underline"
                                >
                                    Forgot Password?
                                </Link>
                            </div>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <HiOutlineLockClosed className="h-5 w-5" />
                                </div>
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    className="input-modern pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-200"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <HiOutlineEyeOff className="h-5 w-5" />
                                    ) : (
                                        <HiOutlineEye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center">
                            <label className="flex cursor-pointer items-center gap-2.5 select-none">
                                <input
                                    type="checkbox"
                                    name="rememberMe"
                                    checked={formData.rememberMe}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-500 accent-blue-500 focus:ring-blue-400 focus:ring-offset-slate-950"
                                />
                                <span className="text-xs text-slate-300">
                                    Remember me for 30 days
                                </span>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary mt-2 flex w-full items-center justify-center gap-2 py-3 text-base font-semibold shadow-[0_0_20px_rgba(46,168,255,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoading ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    <span>Logging in...</span>
                                </>
                            ) : (
                                <span>Login</span>
                            )}
                        </button>
                    </form>

                    {/* Additional Links */}
                    <div className="mt-6 border-t border-slate-800/80 pt-5 text-center text-sm text-slate-400">
                        Don't have an account?{" "}
                        <Link
                            to="/register"
                            className="font-medium text-cyan-400 transition hover:text-cyan-300 hover:underline"
                        >
                            Create Account
                        </Link>
                    </div>
                </motion.div>
            </main>

            <Footer />
        </div>
    )
}

export default LoginPage
