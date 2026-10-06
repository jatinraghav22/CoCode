import { useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import {
    HiOutlineMail,
    HiOutlineIdentification,
    HiOutlineCalendar,
    HiOutlineShieldCheck,
    HiOutlineLogout,
    HiOutlinePencil,
    HiOutlineRefresh,
} from "react-icons/hi"
import { useAuth } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"
import Navbar from "@/components/common/Navbar"
import Footer from "@/components/common/Footer"

const AVATAR_SEEDS = [
    "Felix",
    "Luna",
    "Max",
    "Shadow",
    "Pixel",
    "Cyber",
    "Echo",
    "Byte",
]

const ProfilePage = () => {
    const { user, updateProfile, logout } = useAuth()
    const navigate = useNavigate()

    const [name, setName] = useState(user?.name || "")
    const [selectedAvatar, setSelectedAvatar] = useState(
        user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || "default"}`,
    )
    const [isSaving, setIsSaving] = useState(false)

    const handleAvatarSelect = (seed) => {
        const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`
        setSelectedAvatar(newAvatarUrl)
    }

    const handleRandomAvatar = () => {
        const randomSeed = Math.random().toString(36).substring(2, 8)
        const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(randomSeed)}`
        setSelectedAvatar(newAvatarUrl)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!name.trim()) {
            toast.error("Name cannot be empty")
            return
        }

        setIsSaving(true)
        try {
            const res = await updateProfile({
                name: name.trim(),
                avatar: selectedAvatar,
            })

            if (res.success) {
                toast.success("Profile updated successfully!")
            } else {
                toast.error(res.error || "Failed to update profile")
            }
        } catch {
            toast.error("An error occurred while saving profile")
        } finally {
            setIsSaving(false)
        }
    }

    const handleLogout = () => {
        logout()
        toast.success("Logged out successfully.")
        navigate("/login", { replace: true })
    }

    return (
        <div className="ambient-grid relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,131,255,0.2),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(58,191,177,0.16),transparent_45%)]" />

            <Navbar />

            <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="glass-panel p-6 sm:p-8"
                >
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <img
                                    src={selectedAvatar}
                                    alt={user?.username}
                                    className="h-20 w-20 rounded-2xl border-2 border-cyan-400/40 bg-slate-900 object-cover shadow-[0_0_25px_rgba(56,131,255,0.35)]"
                                />
                                <button
                                    type="button"
                                    onClick={handleRandomAvatar}
                                    title="Generate random avatar"
                                    className="absolute -bottom-2 -right-2 rounded-lg bg-blue-600 p-1.5 text-white shadow-lg transition hover:bg-blue-500"
                                >
                                    <HiOutlineRefresh className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-white">
                                    {user?.name}
                                </h1>
                                <p className="text-sm font-medium text-cyan-400">
                                    @{user?.username}
                                </p>
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                                    <HiOutlineMail className="h-4 w-4" />
                                    {user?.email}
                                </p>
                            </div>
                        </div>

                        <div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
                            >
                                <HiOutlineLogout className="text-base" />
                                Logout
                            </button>
                        </div>
                    </div>

                    {/* Edit Form */}
                    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
                        <div>
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                                Personal Information
                            </h2>
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                            <HiOutlinePencil className="h-4 w-4" />
                                        </div>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="input-modern pl-10"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                                        Username (Immutable)
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                                            <HiOutlineIdentification className="h-4 w-4" />
                                        </div>
                                        <input
                                            type="text"
                                            value={user?.username || ""}
                                            disabled
                                            className="input-modern pl-10 opacity-60 cursor-not-allowed bg-slate-900/40"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                                        Email Address (Immutable)
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                                            <HiOutlineMail className="h-4 w-4" />
                                        </div>
                                        <input
                                            type="email"
                                            value={user?.email || ""}
                                            disabled
                                            className="input-modern pl-10 opacity-60 cursor-not-allowed bg-slate-900/40"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                                        Member Since
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                                            <HiOutlineCalendar className="h-4 w-4" />
                                        </div>
                                        <input
                                            type="text"
                                            value={
                                                user?.createdAt
                                                    ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                                          year: "numeric",
                                                          month: "long",
                                                          day: "numeric",
                                                      })
                                                    : "Active"
                                            }
                                            disabled
                                            className="input-modern pl-10 opacity-60 cursor-not-allowed bg-slate-900/40"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Avatar Presets */}
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Choose Avatar Preset
                                </label>
                                <button
                                    type="button"
                                    onClick={handleRandomAvatar}
                                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                                >
                                    <HiOutlineRefresh className="h-3 w-3" /> Randomize
                                </button>
                            </div>
                            <div className="mt-2.5 flex flex-wrap gap-2.5">
                                {AVATAR_SEEDS.map((seed) => {
                                    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`
                                    const isSelected = selectedAvatar === avatarUrl
                                    return (
                                        <button
                                            type="button"
                                            key={seed}
                                            onClick={() => handleAvatarSelect(seed)}
                                            className={`rounded-xl p-1 transition ${
                                                isSelected
                                                    ? "ring-2 ring-cyan-400 bg-blue-500/20 scale-105"
                                                    : "opacity-75 hover:opacity-100 hover:scale-102"
                                            }`}
                                        >
                                            <img
                                                src={avatarUrl}
                                                alt={seed}
                                                className="h-10 w-10 rounded-lg bg-slate-900"
                                            />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Security notice */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400 flex items-start gap-3">
                            <HiOutlineShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-slate-200">
                                    Account Security & Encryption
                                </p>
                                <p className="mt-0.5 leading-relaxed">
                                    Your password is encrypted using salted bcrypt hashing. Sessions are secured with JSON Web Tokens (JWT) signed using your server's secret key.
                                </p>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="btn-primary py-2.5 px-6 text-sm font-semibold shadow-[0_0_20px_rgba(46,168,255,0.3)] disabled:opacity-60"
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </main>

            <Footer />
        </div>
    )
}

export default ProfilePage
