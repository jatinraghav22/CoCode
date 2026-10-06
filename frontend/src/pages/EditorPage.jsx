import SplitterComponent from "@/components/SplitterComponent"
import Footer from "@/components/common/Footer"
import ConnectionStatusPage from "@/components/connection/ConnectionStatusPage"
import Sidebar from "@/components/sidebar/Sidebar"
import WorkSpace from "@/components/workspace"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useFullScreen from "@/hooks/useFullScreen"
import useUserActivity from "@/hooks/useUserActivity"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS } from "@/types/user"
import { useAuth } from "@/context/AuthContext"
import { useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

function EditorPage() {
    // Listen user online/offline status
    useUserActivity()
    // Enable fullscreen mode
    useFullScreen()
    const { user: authUser } = useAuth()
    const navigate = useNavigate()
    const { roomId } = useParams()
    const { status, setCurrentUser, currentUser } = useAppContext()
    const { socket } = useSocket()
    const location = useLocation()

    useEffect(() => {
        if (currentUser.username.length > 0 && currentUser.roomId === roomId) return
        const username = location.state?.username || authUser?.username
        if (!username) {
            navigate("/join-room", {
                state: { roomId },
            })
        } else if (roomId) {
            const user = { username, roomId }
            setCurrentUser(user)
            if (socket) {
                if (!socket.connected) {
                    socket.connect()
                }
                socket.emit(SocketEvent.JOIN_REQUEST, user)
            }
        }
    }, [
        currentUser.username,
        currentUser.roomId,
        location.state?.username,
        authUser?.username,
        navigate,
        roomId,
        setCurrentUser,
        socket,
    ])

    if (status === USER_STATUS.CONNECTION_FAILED) {
        return <ConnectionStatusPage />
    }

    return (
        <>
            <SplitterComponent>
                <Sidebar />
                <WorkSpace />
            </SplitterComponent>
            <Footer />
        </>
    )
}

export default EditorPage
