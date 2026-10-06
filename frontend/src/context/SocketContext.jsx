import {
    SocketEvent,
} from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react"
import { toast } from "react-hot-toast"
import { io } from "socket.io-client"
import { useAppContext } from "./AppContext"
import { SOCKET_URL } from "@/config/env"

const SocketContext = createContext(null)

export const useSocket = () => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider")
    }
    return context
}

const SocketProvider = ({ children }) => {
    const {
        currentUser,
        users,
        setUsers,
        setStatus,
        setCurrentUser,
        drawingData,
        setDrawingData,
        setRoomActivity,
    } = useAppContext()
    const socket = useMemo(
        () =>
            io(SOCKET_URL, {
                reconnectionAttempts: 2,
            }),
        [],
    )

    const handleError = useCallback(
        (err) => {
            console.log("socket error", err)
            setStatus(USER_STATUS.CONNECTION_FAILED)
            toast.dismiss()
            toast.error("Failed to connect to the server")
        },
        [setStatus],
    )

    const handleUsernameExist = useCallback(() => {
        toast.dismiss()
        setStatus(USER_STATUS.INITIAL)
        toast.error(
            "The username you chose already exists in the room. Please choose a different username.",
        )
    }, [setStatus])

    const handleJoiningAccept = useCallback(
        ({ user, users }) => {
            setCurrentUser({ ...user, template: currentUser.template })
            setUsers(users)
            toast.dismiss()
            setStatus(USER_STATUS.JOINED)
            socket.emit(SocketEvent.REQUEST_ROOM_ACTIVITY)

            if (users.length > 1) {
                toast.loading("Syncing data, please wait...")
            }
        },
        [currentUser.template, setCurrentUser, setStatus, setUsers, socket],
    )

    const handleRoomActivity = useCallback(
        ({ activity }) => {
            setRoomActivity(activity)
        },
        [setRoomActivity],
    )

    const handleUserLeft = useCallback(
        ({ user }) => {
            toast.success(`${user.username} left the room`)
            setUsers(users.filter((u) => u.username !== user.username))
        },
        [setUsers, users],
    )

    const handleRequestDrawing = useCallback(
        ({ socketId }) => {
            socket.emit(SocketEvent.SYNC_DRAWING, { socketId, drawingData })
        },
        [drawingData, socket],
    )

    const handleDrawingSync = useCallback(
        ({ drawingData }) => {
            setDrawingData(drawingData)
        },
        [setDrawingData],
    )

    useEffect(() => {
        socket.on("connect_error", handleError)
        socket.on("connect_failed", handleError)
        socket.on(SocketEvent.USERNAME_EXISTS, handleUsernameExist)
        socket.on(SocketEvent.JOIN_ACCEPTED, handleJoiningAccept)
        socket.on(SocketEvent.USER_DISCONNECTED, handleUserLeft)
        socket.on(SocketEvent.REQUEST_DRAWING, handleRequestDrawing)
        socket.on(SocketEvent.SYNC_DRAWING, handleDrawingSync)
        socket.on(SocketEvent.ROOM_ACTIVITY, handleRoomActivity)

        return () => {
            socket.off("connect_error")
            socket.off("connect_failed")
            socket.off(SocketEvent.USERNAME_EXISTS)
            socket.off(SocketEvent.JOIN_ACCEPTED)
            socket.off(SocketEvent.USER_DISCONNECTED)
            socket.off(SocketEvent.REQUEST_DRAWING)
            socket.off(SocketEvent.SYNC_DRAWING)
            socket.off(SocketEvent.ROOM_ACTIVITY)
        }
    }, [
        handleDrawingSync,
        handleError,
        handleJoiningAccept,
        handleRoomActivity,
        handleRequestDrawing,
        handleUserLeft,
        handleUsernameExist,
        setUsers,
        socket,
    ])

    return (
        <SocketContext.Provider
            value={{
                socket,
            }}
        >
            {children}
        </SocketContext.Provider>
    )
}

export { SocketProvider }
export default SocketContext
