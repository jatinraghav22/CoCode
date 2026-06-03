import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent, SocketId } from "./types/socket"
import { USER_CONNECTION_STATUS, User } from "./types/user"
import { Server } from "socket.io"
import path from "path"

dotenv.config()

const app = express()

app.use(express.json())


app.use(express.static(path.join(__dirname, "public"))) // Serve static files

const server = http.createServer(app)
const defaultAllowedOrigins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://cocode-by-auri.onrender.com",
]

const allowedOrigins = process.env.CORS_ORIGINS
	? process.env.CORS_ORIGINS.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean)
	: defaultAllowedOrigins

app.use(cors({
	origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
}))

const io = new Server(server, {
  cors: {
		origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
})

let userSocketMap: User[] = []

type RoomActivityEntry = {
	id: string
	roomId: string
	type: string
	message: string
	username: string
	timestamp: string
}

type PinnedNote = {
	text: string
	updatedBy: string
	updatedAt: string
}

const roomActivityMap = new Map<string, RoomActivityEntry[]>()
const roomPinnedNoteMap = new Map<string, PinnedNote>()

function generateActivityId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getRoomActivity(roomId: string): RoomActivityEntry[] {
	return roomActivityMap.get(roomId) || []
}

function appendRoomActivity(
	roomId: string,
	type: string,
	message: string,
	username: string,
) {
	const current = getRoomActivity(roomId)
	const next: RoomActivityEntry = {
		id: generateActivityId(),
		roomId,
		type,
		message,
		username,
		timestamp: new Date().toISOString(),
	}

	const updated = [...current, next].slice(-120)
	roomActivityMap.set(roomId, updated)
	io.to(roomId).emit(SocketEvent.ROOM_ACTIVITY, { activity: updated })
}

// Function to get all users in a room
function getUsersInRoom(roomId: string): User[] {
	return userSocketMap.filter((user) => user.roomId == roomId)
}

// Function to get room id by socket id
function getRoomId(socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId

	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

function getUserBySocketId(socketId: SocketId): User | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

io.on("connection", (socket) => {
	// Handle user actions
	socket.on(SocketEvent.JOIN_REQUEST, ({ roomId, username }) => {
		// Check is username exist in the room
		const isUsernameExist = getUsersInRoom(roomId).filter(
			(u) => u.username === username
		)
		if (isUsernameExist.length > 0) {
			io.to(socket.id).emit(SocketEvent.USERNAME_EXISTS)
			return
		}

		const user = {
			username,
			roomId,
			status: USER_CONNECTION_STATUS.ONLINE,
			cursorPosition: 0,
			typing: false,
			socketId: socket.id,
			currentFile: null,
		}
		userSocketMap.push(user)
		socket.join(roomId)
		socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user })
		const users = getUsersInRoom(roomId)
		io.to(socket.id).emit(SocketEvent.JOIN_ACCEPTED, { user, users })
		io.to(socket.id).emit(SocketEvent.ROOM_ACTIVITY, {
			activity: getRoomActivity(roomId),
		})

		const pinnedNote = roomPinnedNoteMap.get(roomId)
		if (pinnedNote) {
			io.to(socket.id).emit(SocketEvent.PINNED_NOTE_SET, {
				note: pinnedNote,
			})
		}

		appendRoomActivity(
			roomId,
			"user",
			`${username} joined the room`,
			username,
		)
	})

	socket.on("disconnecting", () => {
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.USER_DISCONNECTED, { user })
		appendRoomActivity(
			roomId,
			"user",
			`${user.username} left the room`,
			user.username,
		)
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		socket.leave(roomId)
	})

	socket.on(SocketEvent.REQUEST_ROOM_ACTIVITY, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		io.to(socket.id).emit(SocketEvent.ROOM_ACTIVITY, {
			activity: getRoomActivity(roomId),
		})
	})

	// Handle file actions
	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		({ fileStructure, openFiles, activeFile, socketId }) => {
			io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, {
				fileStructure,
				openFiles,
				activeFile,
			})
		}
	)

	socket.on(
		SocketEvent.DIRECTORY_CREATED,
		({ parentDirId, newDirectory }) => {
			const roomId = getRoomId(socket.id)
			if (!roomId) return
			const user = getUserBySocketId(socket.id)
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, {
				parentDirId,
				newDirectory,
			})
			appendRoomActivity(
				roomId,
				"file",
				`Created folder ${newDirectory.name}`,
				user?.username || "unknown",
			)
		}
	)

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, {
			dirId,
			children,
		})
	})

	socket.on(
		SocketEvent.DIRECTORY_RENAMED,
		({ dirId, newName, newDirName, oldName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		const user = getUserBySocketId(socket.id)
		const nextName = newName || newDirName || "folder"
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, {
			dirId,
			newName: nextName,
		})
		appendRoomActivity(
			roomId,
			"file",
			oldName
				? `Renamed folder ${oldName} to ${nextName}`
				: `Renamed folder to ${nextName}`,
			user?.username || "unknown",
		)
		}
	)

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId, dirName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		const user = getUserBySocketId(socket.id)
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
		appendRoomActivity(
			roomId,
			"file",
			dirName ? `Deleted folder ${dirName}` : `Deleted a folder`,
			user?.username || "unknown",
		)
	})

	socket.on(SocketEvent.FILE_CREATED, ({ parentDirId, newFile }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		const user = getUserBySocketId(socket.id)
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
		appendRoomActivity(
			roomId,
			"file",
			`Created file ${newFile.name}`,
			user?.username || "unknown",
		)
	})

	socket.on(SocketEvent.FILE_UPDATED, ({ fileId, newContent }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, {
			fileId,
			newContent,
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName, oldName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		const user = getUserBySocketId(socket.id)
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, {
			fileId,
			newName,
		})
		appendRoomActivity(
			roomId,
			"file",
			oldName
				? `Renamed ${oldName} to ${newName}`
				: `Renamed file to ${newName}`,
			user?.username || "unknown",
		)
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId, fileName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		const user = getUserBySocketId(socket.id)
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
		appendRoomActivity(
			roomId,
			"file",
			fileName ? `Deleted ${fileName}` : `Deleted a file`,
			user?.username || "unknown",
		)
	})

	// Handle user status
	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	socket.on(SocketEvent.CURRENT_FILE_CHANGED, ({ currentFile }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, currentFile }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.CURRENT_FILE_CHANGED, {
			user,
		})
	})

	// Handle chat actions
	socket.on(SocketEvent.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	socket.on(SocketEvent.PINNED_NOTE_SET, ({ note }) => {
		const roomId = getRoomId(socket.id)
		const user = getUserBySocketId(socket.id)
		if (!roomId || !user) return

		const payload: PinnedNote = {
			text: note?.text || "",
			updatedBy: user.username,
			updatedAt: new Date().toISOString(),
		}

		roomPinnedNoteMap.set(roomId, payload)
		io.to(roomId).emit(SocketEvent.PINNED_NOTE_SET, { note: payload })
		appendRoomActivity(
			roomId,
			"note",
			`Updated room note`,
			user.username,
		)
	})

	socket.on(SocketEvent.PINNED_NOTE_CLEARED, () => {
		const roomId = getRoomId(socket.id)
		const user = getUserBySocketId(socket.id)
		if (!roomId || !user) return

		roomPinnedNoteMap.delete(roomId)
		io.to(roomId).emit(SocketEvent.PINNED_NOTE_CLEARED)
		appendRoomActivity(
			roomId,
			"note",
			`Cleared room note`,
			user.username,
		)
	})

	socket.on(SocketEvent.CODE_EXECUTED, ({ fileName, language }) => {
		const roomId = getRoomId(socket.id)
		const user = getUserBySocketId(socket.id)
		if (!roomId || !user) return

		appendRoomActivity(
			roomId,
			"run",
			`Ran ${fileName || "active file"} with ${language || "selected language"}`,
			user.username,
		)
	})

	// Handle cursor position
	socket.on(SocketEvent.TYPING_START, ({ cursorPosition }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: true, cursorPosition }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_START, { user })
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, {
			snapshot,
		})
	})
})

const PORT = process.env.PORT || 3000

app.get("/", (req: Request, res: Response) => {
	// Send the index.html file
	res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
