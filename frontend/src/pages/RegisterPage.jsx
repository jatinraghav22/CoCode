import { useState, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import {
    HiOutlineUser,
    HiOutlineIdentification,
    HiOutlineMail,
    HiOutlineLockClosed,
    HiOutlineEye,
    HiOutlineEyeOff,
    HiCheck,
    HiX,
} from "react-icons/hi"
import { useAuth } from "@/context/AuthContext"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RegisterPage = () => {
    const navigate = useNavigate()
    const { register } = useAuth()

    const [formData, setFormData] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
    })

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState(null)
    const [touchedPassword, setTouchedPassword] = useState(false)

    // Password requirement rules
    const passwordRequirements = useMemo(() => {
        const pwd = formData.password
        return {
            minLength: pwd.length >= 8,
            hasUpper: /[A-Z]/.test(pwd),
            hasLower: /[a-z]/.test(pwd),
            hasNumber: /\d/.test(pwd),
        }
    }, [formData.password])

    const isPasswordValid =
        passwordRequirements.minLength &&
        passwordRequirements.hasUpper &&
        passwordRequirements.hasLower &&
        passwordRequirements.hasNumber

    const passwordsMatch =
        formData.confirmPassword.length > 0 &&
        formData.password === formData.confirmPassword

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))

        if (name === "password") {
            setTouchedPassword(true)
        }

        if (errorMessage) {
            setErrorMessage(null)
        }
    }

    const validateForm = () => {
        if (!formData.name.trim()) {
            setErrorMessage("Full Name is required")
            return false
        }

        if (!formData.username.trim()) {
            setErrorMessage("Username is required")
            return false
        }

        if (formData.username.trim().length < 3) {
            setErrorMessage("Username must be at least 3 characters")
            return false
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(formData.username.trim())) {
            setErrorMessage("Username can only contain letters, numbers, and underscores")
            return false
        }

        if (!formData.email.trim() || !EMAIL_REGEX.test(formData.email.trim())) {
            setErrorMessage("Please enter a valid email address")
            return false
        }

        if (!isPasswordValid) {
            setErrorMessage("Password does not meet all the required criteria")
            return false
        }

        if (formData.password !== formData.confirmPassword) {
            setErrorMessage("Passwords do not match")
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
            const result = await register({
                name: formData.name.trim(),
                username: formData.username.trim(),
                email: formData.email.trim(),
                password: formData.password,
                confirmPassword: formData.confirmPassword,
            })

            if (result.success) {
                toast.success(
                    result.message ||
                        "Account created successfully! Please login to continue.",
                    { duration: 4000 },
                )
                navigate("/login", { replace: true })
            } else {
                setErrorMessage(result.error || "Failed to create account")
            }
        } catch {
            setErrorMessage("Unable to connect to CoCode server. Please try again.")
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
                    className="glass-panel w-full max-lg p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-blue-500/20"
                >
                    {/* Header */}
                    <div className="mb-6 flex flex-col items-center text-center">
                        <img
                            src="/icon.png"
                            alt="CoCode Logo"
                            className="h-12 w-12 rounded-xl shadow-[0_0_20px_rgba(56,131,255,0.4)]"
                        />
                        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                            Create your account
                        </h1>
                        <p className="mt-1.5 text-sm text-slate-400">
                            Join CoCode for seamless real-time collaborative coding
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
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* Name and Username row */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="register-name"
                                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
                                >
                                    Full Name
                                </label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                        <HiOutlineUser className="h-5 w-5" />
                                    </div>
                                    <input
                                        id="register-name"
                                        type="text"
                                        name="name"
                                        placeholder="Alex Developer"
                                        value={formData.name}
                                        onChange={handleChange}
                                        disabled={isLoading}
                                        className="input-modern pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="register-username"
                                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
                                >
                                    Username
                                </label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                        <HiOutlineIdentification className="h-5 w-5" />
                                    </div>
                                    <input
                                        id="register-username"
                                        type="text"
                                        name="username"
                                        placeholder="alex_dev"
                                        value={formData.username}
                                        onChange={handleChange}
                                        disabled={isLoading}
                                        className="input-modern pl-10"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label
                                htmlFor="register-email"
                                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
                            >
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <HiOutlineMail className="h-5 w-5" />
                                </div>
                                <input
                                    id="register-email"
                                    type="email"
                                    name="email"
                                    placeholder="alex@example.com"
                                    autoComplete="email"
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
                            <label
                                htmlFor="register-password"
                                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <HiOutlineLockClosed className="h-5 w-5" />
                                </div>
                                <input
                                    id="register-password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    autoComplete="new-password"
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

                            {/* Live Password Requirements */}
                            <div className="mt-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                                <p className="mb-2 font-medium text-slate-300">
                                    Password requirements:
                                </p>
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                    <div
                                        className={`flex items-center gap-1.5 transition ${
                                            passwordRequirements.minLength
                                                 ? "text-emerald-400"
                                                : touchedPassword
                                                  ? "text-slate-500"
                                                  : "text-slate-400"
                                        }`}
                                    >
                                        {passwordRequirements.minLength ? (
                                            <HiCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                                        ) : (
                                            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600 ml-1 mr-1.5" />
                                        )}
                                        <span>Minimum 8 characters</span>
                                    </div>
                                    <div
                                        className={`flex items-center gap-1.5 transition ${
                                            passwordRequirements.hasUpper
                                                ? "text-emerald-400"
                                                : touchedPassword
                                                  ? "text-slate-500"
                                                  : "text-slate-400"
                                        }`}
                                    >
                                        {passwordRequirements.hasUpper ? (
                                            <HiCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                                        ) : (
                                            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600 ml-1 mr-1.5" />
                                        )}
                                        <span>At least one uppercase</span>
                                    </div>
                                    <div
                                        className={`flex items-center gap-1.5 transition ${
                                            passwordRequirements.hasLower
                                                ? "text-emerald-400"
                                                : touchedPassword
                                                  ? "text-slate-500"
                                                  : "text-slate-400"
                                        }`}
                                    >
                                        {passwordRequirements.hasLower ? (
                                            <HiCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                                        ) : (
                                            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600 ml-1 mr-1.5" />
                                        )}
                                        <span>At least one lowercase</span>
                                    </div>
                                    <div
                                        className={`flex items-center gap-1.5 transition ${
                                            passwordRequirements.hasNumber
                                                ? "text-emerald-400"
                                                : touchedPassword
                                                  ? "text-slate-500"
                                                  : "text-slate-400"
                                        }`}
                                    >
                                        {passwordRequirements.hasNumber ? (
                                            <HiCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                                        ) : (
                                            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600 ml-1 mr-1.5" />
                                        )}
                                        <span>At least one number</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label
                                htmlFor="register-confirm-password"
                                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
                            >
                                Confirm Password
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <HiOutlineLockClosed className="h-5 w-5" />
                                </div>
                                <input
                                    id="register-confirm-password"
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    className={`input-modern pl-10 pr-10 ${
                                        formData.confirmPassword.length > 0
                                            ? passwordsMatch
                                                ? "border-emerald-500/50"
                                                : "border-red-500/50"
                                            : ""
                                    }`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-200"
                                    aria-label={
                                        showConfirmPassword
                                            ? "Hide confirm password"
                                            : "Show confirm password"
                                    }
                                >
                                    {showConfirmPassword ? (
                                        <HiOutlineEyeOff className="h-5 w-5" />
                                    ) : (
                                        <HiOutlineEye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                            {formData.confirmPassword.length > 0 && (
                                <p
                                    className={`mt-1.5 flex items-center gap-1 text-xs ${
                                        passwordsMatch ? "text-emerald-400" : "text-red-400"
                                    }`}
                                >
                                    {passwordsMatch ? (
                                        <>
                                            <HiCheck className="h-3.5 w-3.5" /> Passwords match
                                        </>
                                    ) : (
                                        <>
                                            <HiX className="h-3.5 w-3.5" /> Passwords do not match
                                        </>
                                    )}
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary mt-3 flex w-full items-center justify-center gap-2 py-3 text-base font-semibold shadow-[0_0_20px_rgba(46,168,255,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoading ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <span>Create Account</span>
                            )}
                        </button>
                    </form>

                    {/* Additional Links */}
                    <div className="mt-6 border-t border-slate-800/80 pt-5 text-center text-sm text-slate-400">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="font-medium text-cyan-400 transition hover:text-cyan-300 hover:underline"
                        >
                            Login
                        </Link>
                    </div>
                </motion.div>
            </main>

            <Footer />
        </div>
    )
}

export default RegisterPage
