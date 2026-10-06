import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react"
import { getMeApi, loginApi, logoutApi, registerApi, updateProfileApi } from "@/api/authApi"
import axios from "axios"

const TOKEN_KEY = "cocodee_auth_token"
const USER_KEY = "cocodee_auth_user"

const AuthContext = createContext(null)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => {
        return (
            localStorage.getItem(TOKEN_KEY) ||
            sessionStorage.getItem(TOKEN_KEY) ||
            null
        )
    })

    const [user, setUser] = useState(() => {
        const storedUser =
            localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
        if (storedUser) {
            try {
                return JSON.parse(storedUser)
            } catch {
                return null
            }
        }
        return null
    })

    const [isLoading, setIsLoading] = useState(true)

    const clearStoredAuth = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
    }, [])

    // Verify token on mount or token change
    useEffect(() => {
        let isMounted = true

        const verifyToken = async () => {
            const activeToken =
                localStorage.getItem(TOKEN_KEY) ||
                sessionStorage.getItem(TOKEN_KEY)

            if (!activeToken) {
                if (isMounted) {
                    setIsLoading(false)
                    setUser(null)
                    setToken(null)
                }
                return
            }

            try {
                const response = await getMeApi(activeToken)
                if (isMounted) {
                    setUser(response.user)
                    setToken(activeToken)
                    // Sync user in whichever storage had the token
                    if (localStorage.getItem(TOKEN_KEY)) {
                        localStorage.setItem(USER_KEY, JSON.stringify(response.user))
                    } else {
                        sessionStorage.setItem(USER_KEY, JSON.stringify(response.user))
                    }
                }
            } catch {
                if (isMounted) {
                    clearStoredAuth()
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        verifyToken()

        return () => {
            isMounted = false
        }
    }, [clearStoredAuth])

    const login = async (formData) => {
        try {
            const response = await loginApi(formData)
            if (response.token && response.user) {
                const authToken = response.token
                const authUser = response.user

                if (formData.rememberMe) {
                    localStorage.setItem(TOKEN_KEY, authToken)
                    localStorage.setItem(USER_KEY, JSON.stringify(authUser))
                    sessionStorage.removeItem(TOKEN_KEY)
                    sessionStorage.removeItem(USER_KEY)
                } else {
                    sessionStorage.setItem(TOKEN_KEY, authToken)
                    sessionStorage.setItem(USER_KEY, JSON.stringify(authUser))
                    localStorage.removeItem(TOKEN_KEY)
                    localStorage.removeItem(USER_KEY)
                }

                setToken(authToken)
                setUser(authUser)
                return { success: true }
            }
            return {
                success: false,
                error: response.message || "Failed to log in",
            }
        } catch (error) {
            let errorMsg = "Unable to connect to the server. Please try again."
            if (axios.isAxiosError(error)) {
                if (error.response?.data?.message) {
                    errorMsg = error.response.data.message
                } else if (error.message === "Network Error") {
                    errorMsg = "Unable to connect to the server. Please try again."
                }
            }
            return { success: false, error: errorMsg }
        }
    }

    const register = async (formData) => {
        try {
            const response = await registerApi(formData)
            return {
                success: true,
                message:
                    response.message ||
                    "Account created successfully! Please login to continue.",
            }
        } catch (error) {
            let errorMsg = "Unable to connect to the server. Please try again."
            if (axios.isAxiosError(error)) {
                if (error.response?.data?.message) {
                    errorMsg = error.response.data.message
                } else if (error.message === "Network Error") {
                    errorMsg = "Unable to connect to the server. Please try again."
                }
            }
            return { success: false, error: errorMsg }
        }
    }

    const logout = useCallback(() => {
        logoutApi().catch(() => {})
        clearStoredAuth()
    }, [clearStoredAuth])

    const updateProfile = async (data) => {
        if (!token) return { success: false, error: "Not authenticated" }
        try {
            const response = await updateProfileApi(data, token)
            setUser(response.user)
            if (localStorage.getItem(TOKEN_KEY)) {
                localStorage.setItem(USER_KEY, JSON.stringify(response.user))
            } else {
                sessionStorage.setItem(USER_KEY, JSON.stringify(response.user))
            }
            return { success: true }
        } catch (error) {
            let errorMsg = "Failed to update profile"
            if (axios.isAxiosError(error) && error.response?.data?.message) {
                errorMsg = error.response.data.message
            }
            return { success: false, error: errorMsg }
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: Boolean(token && user),
                isLoading,
                login,
                register,
                logout,
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext
