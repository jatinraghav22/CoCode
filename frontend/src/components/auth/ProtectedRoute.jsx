import { Navigate, useLocation, Outlet } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth()
    const location = useLocation()

    if (isLoading) {
        return (
            <div className="ambient-grid flex min-h-screen items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-cyan-400 shadow-[0_0_20px_rgba(56,131,255,0.4)]" />
                    <p className="text-sm font-medium tracking-wide text-slate-400 animate-pulse">
                        Authenticating with CoCode...
                    </p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return children ? <>{children}</> : <Outlet />
}

export default ProtectedRoute
