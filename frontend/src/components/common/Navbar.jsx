import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useSocket } from "@/context/SocketContext"
import { useAppContext } from "@/context/AppContext"
import { USER_STATUS } from "@/types/user"
import {
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineLogout,
    HiOutlineUser,
    HiOutlineViewGrid,
    HiOutlineCode,
    HiOutlinePlus,
    HiOutlineLogin,
} from "react-icons/hi"
import { toast } from "react-hot-toast"

const Navbar = ({ className = "" }) => {
    const { user, isAuthenticated, logout } = useAuth()
    const { socket } = useSocket()
    const { setStatus, setCurrentUser } = useAppContext()
    const navigate = useNavigate()
    const location = useLocation()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const handleLogout = () => {
        if (socket && socket.connected) {
            socket.disconnect()
        }
        setStatus(USER_STATUS.DISCONNECTED)
        setCurrentUser({ username: "", roomId: "" })

        logout()
        toast.success("Logged out successfully.")
        navigate("/login", { replace: true })
    }

    const isActive = (path) => location.pathname === path

    return (
        <header
            className={`sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl transition-all ${className}`}
        >
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo */}
                <Link
                    to={isAuthenticated ? "/compiler" : "/"}
                    className="flex items-center gap-3 transition-transform hover:scale-[1.02]"
                >
                    <img
                        src="/icon.png"
                        alt="CoCode Logo"
                        className="h-8 w-8 rounded-xl shadow-[0_0_15px_rgba(56,131,255,0.35)]"
                    />
                    <div className="flex flex-col">
                        <span className="text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-cyan-300 to-teal-200">
                            CoCode
                        </span>
                        <span className="hidden text-[9px] uppercase tracking-widest text-slate-400 sm:block -mt-1">
                            Online Compiler & IDE
                        </span>
                    </div>
                </Link>

                {/* Desktop Center Links */}
                <nav className="hidden items-center gap-1 md:flex">
                    {isAuthenticated ? (
                        <>
                            <Link
                                to="/compiler"
                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                    isActive("/compiler")
                                        ? "border border-cyan-400/40 bg-blue-500/20 text-cyan-200 shadow-[0_0_12px_rgba(56,131,255,0.2)]"
                                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                                }`}
                            >
                                <HiOutlineCode className="text-sm text-cyan-400" />
                                Compiler
                            </Link>

                            <Link
                                to="/dashboard"
                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                    isActive("/dashboard") || isActive("/rooms")
                                        ? "border border-cyan-400/40 bg-blue-500/20 text-cyan-200 shadow-[0_0_12px_rgba(56,131,255,0.2)]"
                                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                                }`}
                            >
                                <HiOutlineViewGrid className="text-sm text-blue-400" />
                                Rooms
                            </Link>

                            <Link
                                to="/create-room"
                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                    isActive("/create-room")
                                        ? "border border-cyan-400/40 bg-blue-500/20 text-cyan-200"
                                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                                }`}
                            >
                                <HiOutlinePlus className="text-sm text-emerald-400" />
                                Create Room
                            </Link>

                            <Link
                                to="/join-room"
                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                    isActive("/join-room")
                                        ? "border border-cyan-400/40 bg-blue-500/20 text-cyan-200"
                                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                                }`}
                            >
                                <HiOutlineLogin className="text-sm text-amber-400" />
                                Join Room
                            </Link>
                        </>
                    ) : (
                        <Link
                            to="/"
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                isActive("/")
                                    ? "bg-blue-500/20 text-cyan-300"
                                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                            }`}
                        >
                            Home
                        </Link>
                    )}
                </nav>

                {/* Desktop Right Auth Section */}
                <div className="hidden items-center gap-3 md:flex">
                    {!isAuthenticated ? (
                        <>
                            <Link
                                to="/login"
                                className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-blue-400/50 hover:bg-slate-800 hover:text-white"
                            >
                                Login
                            </Link>
                            <Link
                                to="/register"
                                className="btn-primary px-3.5 py-1.5 text-xs font-bold shadow-[0_0_15px_rgba(46,168,255,0.25)] hover:shadow-[0_0_20px_rgba(46,168,255,0.4)]"
                            >
                                Create Account
                            </Link>
                        </>
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <Link
                                to="/profile"
                                className={`flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 py-1 pl-1.5 pr-2.5 text-xs transition hover:border-blue-400/40 hover:bg-slate-800/60 ${
                                    isActive("/profile") ? "border-cyan-400/50 bg-slate-800" : ""
                                }`}
                            >
                                {user?.avatar ? (
                                    <img
                                        src={user.avatar}
                                        alt={user.username}
                                        className="h-6 w-6 rounded-lg border border-cyan-400/30 bg-slate-800 object-cover"
                                    />
                                ) : (
                                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600/30 text-[11px] font-bold text-cyan-300">
                                        {user?.username?.charAt(0).toUpperCase() || "U"}
                                    </div>
                                )}
                                <span className="text-xs font-medium text-slate-200">
                                    {user?.username}
                                </span>
                            </Link>

                            <button
                                onClick={handleLogout}
                                title="Logout"
                                className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
                            >
                                <HiOutlineLogout className="text-sm" />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex items-center md:hidden">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                        aria-label="Toggle navigation menu"
                    >
                        {mobileMenuOpen ? (
                            <HiOutlineX className="h-5 w-5" />
                        ) : (
                            <HiOutlineMenu className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
                <div className="border-b border-slate-800 bg-slate-950/95 px-4 pb-5 pt-2 backdrop-blur-2xl md:hidden">
                    <div className="flex flex-col gap-1.5">
                        {isAuthenticated ? (
                            <>
                                <Link
                                    to="/compiler"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                                        isActive("/compiler")
                                            ? "bg-blue-600/20 text-cyan-300 font-bold"
                                            : "text-slate-200 hover:bg-slate-800"
                                    }`}
                                >
                                    <HiOutlineCode className="text-cyan-400" />
                                    Compiler
                                </Link>
                                <Link
                                    to="/dashboard"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    <HiOutlineViewGrid className="text-blue-400" />
                                    Rooms / Dashboard
                                </Link>
                                <Link
                                    to="/create-room"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    <HiOutlinePlus className="text-emerald-400" />
                                    Create Room
                                </Link>
                                <Link
                                    to="/join-room"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    <HiOutlineLogin className="text-amber-400" />
                                    Join Room
                                </Link>
                                <Link
                                    to="/profile"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    <HiOutlineUser />
                                    Profile ({user?.username})
                                </Link>
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false)
                                        handleLogout()
                                    }}
                                    className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400"
                                >
                                    <HiOutlineLogout />
                                    Logout
                                </button>
                            </>
                        ) : (
                            <div className="mt-2 flex flex-col gap-2">
                                <Link
                                    to="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 text-center text-xs font-semibold text-slate-200"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="btn-primary w-full py-2 text-center text-xs font-bold"
                                >
                                    Create Account
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    )
}

export default Navbar
