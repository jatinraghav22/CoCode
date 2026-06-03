import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import { SocketEvent } from "@/types/socket"
import { RoomTemplate, USER_STATUS } from "@/types/user"
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { useLocation, useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"
import { motion } from "framer-motion"
import Select from "@/components/common/Select"

const ROOM_TEMPLATES: RoomTemplate[] = ["blank", "frontend", "interview"]

const FormComponent = () => {
    const location = useLocation()
    const { currentUser, setCurrentUser, status, setStatus } = useAppContext()
    const { socket } = useSocket()

    const usernameRef = useRef<HTMLInputElement | null>(null)
    const navigate = useNavigate()
    const generatedRoomRef = useRef(false)
    const [selectedTemplate, setSelectedTemplate] =
        useState<RoomTemplate>("blank")

    const createNewRoomId = () => {
        generatedRoomRef.current = true
        setCurrentUser({
            ...currentUser,
            roomId: uuidv4(),
            template: selectedTemplate,
        })
        toast.success("Created a new Room Id")
        usernameRef.current?.focus()
    }

    const handleInputChanges = (e: ChangeEvent<HTMLInputElement>) => {
        const name = e.target.name
        const value = e.target.value
        if (name === "roomId") {
            generatedRoomRef.current = false
        }
        setCurrentUser({ ...currentUser, [name]: value, template: undefined })
    }

    const validateForm = () => {
        if (currentUser.username.trim().length === 0) {
            toast.error("Enter your username")
            return false
        } else if (currentUser.roomId.trim().length === 0) {
            toast.error("Enter a room id")
            return false
        } else if (currentUser.roomId.trim().length < 5) {
            toast.error("ROOM Id must be at least 5 characters long")
            return false
        } else if (currentUser.username.trim().length < 3) {
            toast.error("Username must be at least 3 characters long")
            return false
        }
        return true
    }

    const joinRoom = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (status === USER_STATUS.ATTEMPTING_JOIN) return
        if (!validateForm()) return
        toast.loading("Joining room...")
        setStatus(USER_STATUS.ATTEMPTING_JOIN)
        const joinPayload = {
            ...currentUser,
            template: generatedRoomRef.current ? selectedTemplate : undefined,
        }
        setCurrentUser(joinPayload)
        socket.emit(SocketEvent.JOIN_REQUEST, joinPayload)
    }

    useEffect(() => {
        if (currentUser.roomId.length > 0) return
        if (location.state?.roomId) {
            setCurrentUser({ ...currentUser, roomId: location.state.roomId })
            if (currentUser.username.length === 0) {
                toast.success("Enter your username")
            }
        }
    }, [currentUser, location.state?.roomId, setCurrentUser])

    useEffect(() => {
        if (status === USER_STATUS.DISCONNECTED && !socket.connected) {
            socket.connect()
            return
        }

        const isRedirect = sessionStorage.getItem("redirect") || false

        if (status === USER_STATUS.JOINED && !isRedirect) {
            const username = currentUser.username
            sessionStorage.setItem("redirect", "true")
            navigate(`/editor/${currentUser.roomId}`, {
                state: {
                    username,
                },
            })
        } else if (status === USER_STATUS.JOINED && isRedirect) {
            sessionStorage.removeItem("redirect")
            setStatus(USER_STATUS.DISCONNECTED)
            socket.disconnect()
            socket.connect()
        }
    }, [
        currentUser,
        location.state?.redirect,
        navigate,
        setStatus,
        socket,
        status,
    ])

    return (
        <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="glass-panel flex w-full max-w-[520px] flex-col gap-5 p-5 sm:p-7"
        >
            <div className="flex items-center gap-3">
                <img
                    src="./icon.png"
                    alt="logo"
                    className="h-12 w-12 rounded-xl"
                />
                <div>
                    <p className="text-3xl font-black leading-none text-blue-300">
                        CoCode
                    </p>
                    <p className="mt-1 text-sm text-slate-300">code together</p>
                </div>
            </div>

            <form onSubmit={joinRoom} className="flex w-full flex-col gap-3">
                <Select
                    onChange={(e) =>
                        setSelectedTemplate(e.target.value as RoomTemplate)
                    }
                    value={selectedTemplate}
                    options={ROOM_TEMPLATES}
                    title="Starter Template"
                />
                <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Room Id
                </label>
                <input
                    type="text"
                    name="roomId"
                    placeholder="Room Id"
                    className="input-modern"
                    onChange={handleInputChanges}
                    value={currentUser.roomId}
                />
                <label className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                    Username
                </label>
                <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    className="input-modern"
                    onChange={handleInputChanges}
                    value={currentUser.username}
                    ref={usernameRef}
                />
                <button
                    type="submit"
                    className="btn-primary mt-3 w-full py-3 text-lg"
                >
                    Join
                </button>
            </form>
            <button
                className="self-start text-sm text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
                onClick={createNewRoomId}
            >
                Generate Unique Room Id
            </button>
        </motion.div>
    )
}

export default FormComponent
