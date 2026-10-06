import jwt from "jsonwebtoken"
import { findUserById, toSafeUser } from "../db/userStore.js"

const JWT_SECRET = process.env.JWT_SECRET || "cocodee-super-secure-jwt-secret-key-2025"

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    console.warn("WARNING: JWT_SECRET environment variable is not defined in production. Using fallback secret. Please configure JWT_SECRET for maximum security.")
}

export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ message: "Authentication required" })
        return
    }

    const token = authHeader.split(" ")[1]

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        const user = findUserById(decoded.id)

        if (!user) {
            res.status(401).json({ message: "User not found or account deactivated" })
            return
        }

        req.user = toSafeUser(user)
        next()
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token" })
    }
}

export function generateToken(userId, email, username, rememberMe = false) {
    const expiresIn = rememberMe ? "30d" : "24h"
    return jwt.sign({ id: userId, email, username }, JWT_SECRET, { expiresIn })
}
