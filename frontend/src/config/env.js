/**
 * Centralized frontend environment configuration
 * Automatically manages backend API and Socket.IO endpoints
 * across development and production environments.
 */

const sanitizeUrl = (url) => {
    if (!url || typeof url !== "string") return ""
    return url.trim().replace(/\/+$/, "")
}

const resolveBaseUrl = () => {
    const envUrl =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_BACKEND_URL

    if (envUrl) {
        return sanitizeUrl(envUrl)
    }

    // In local development, default to local backend server
    if (import.meta.env.DEV) {
        return "http://localhost:5000"
    }

    // In production without explicit VITE_API_URL, fallback to window.location.origin
    // (applicable if frontend and backend are served from the same host or proxy)
    if (typeof window !== "undefined" && window.location?.origin) {
        return sanitizeUrl(window.location.origin)
    }

    return ""
}

export const API_URL = resolveBaseUrl()

const resolveSocketUrl = () => {
    const socketEnv = import.meta.env.VITE_SOCKET_URL
    if (socketEnv) {
        return sanitizeUrl(socketEnv)
    }
    return API_URL
}

export const SOCKET_URL = resolveSocketUrl()

export const BACKEND_URL = API_URL
