import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, "..", "..", "data")
const USERS_FILE = path.join(DATA_DIR, "users.json")

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), "utf-8")
    }
}

function readUsers() {
    try {
        ensureStorage()
        const content = fs.readFileSync(USERS_FILE, "utf-8")
        if (!content.trim()) return []
        return JSON.parse(content)
    } catch (err) {
        console.error("Error reading users store:", err)
        return []
    }
}

function writeUsers(users) {
    try {
        ensureStorage()
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8")
    } catch (err) {
        console.error("Error writing users store:", err)
    }
}

export function toSafeUser(user) {
    const { passwordHash: _, ...safeUser } = user
    return safeUser
}

export function findUserById(id) {
    const users = readUsers()
    return users.find((u) => u.id === id)
}

export function findUserByEmail(email) {
    const normalized = email.trim().toLowerCase()
    const users = readUsers()
    return users.find((u) => u.email.toLowerCase() === normalized)
}

export function findUserByUsername(username) {
    const normalized = username.trim().toLowerCase()
    const users = readUsers()
    return users.find((u) => u.username.toLowerCase() === normalized)
}

export function createUser(userData) {
    const users = readUsers()
    const now = new Date().toISOString()
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const newUser = {
        id,
        ...userData,
        createdAt: now,
        updatedAt: now,
    }

    users.push(newUser)
    writeUsers(users)
    return newUser
}

export function updateUser(id, updates) {
    const users = readUsers()
    const index = users.findIndex((u) => u.id === id)
    if (index === -1) return null

    users[index] = {
        ...users[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    }

    writeUsers(users)
    return users[index]
}

export function getAllUsersCount() {
    return readUsers().length
}
