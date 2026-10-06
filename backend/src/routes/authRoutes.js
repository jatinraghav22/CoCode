import express from "express"
import bcrypt from "bcryptjs"
import {
    createUser,
    findUserByEmail,
    findUserByUsername,
    toSafeUser,
    updateUser,
} from "../db/userStore.js"
import {
    authMiddleware,
    generateToken,
} from "../middleware/authMiddleware.js"

const router = express.Router()

// Password validation regex
// Min 8 characters, at least 1 uppercase, 1 lowercase, 1 number
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/auth/register
 */
router.post("/register", async (req, res) => {
    try {
        const { name, username, email, password, confirmPassword } = req.body

        // 1. Validation checks
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ message: "Full Name is required" })
        }

        if (!username || typeof username !== "string" || username.trim().length < 3) {
            return res.status(400).json({ message: "Username must be at least 3 characters long" })
        }

        const trimmedUsername = username.trim()
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
            return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" })
        }

        if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
            return res.status(400).json({ message: "Please enter a valid email address" })
        }

        const trimmedEmail = email.trim().toLowerCase()

        if (!password || typeof password !== "string") {
            return res.status(400).json({ message: "Password is required" })
        }

        if (!PASSWORD_REGEX.test(password)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number",
            })
        }

        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" })
        }

        // 2. Uniqueness checks
        const existingEmail = findUserByEmail(trimmedEmail)
        if (existingEmail) {
            return res.status(409).json({ message: "An account with this email already exists" })
        }

        const existingUsername = findUserByUsername(trimmedUsername)
        if (existingUsername) {
            return res.status(409).json({ message: "Username is already taken" })
        }

        // 3. Hash password
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(password, saltRounds)

        // 4. Default avatar
        const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedUsername)}`

        // 5. Create user
        const newUser = createUser({
            name: name.trim(),
            username: trimmedUsername,
            email: trimmedEmail,
            passwordHash,
            avatar,
        })

        const safeUser = toSafeUser(newUser)
        const token = generateToken(newUser.id, newUser.email, newUser.username)

        return res.status(201).json({
            message: "Account created successfully! Please login to continue.",
            user: safeUser,
            token,
        })
    } catch (error) {
        console.error("Registration error:", error)
        return res.status(500).json({ message: "Unable to process registration. Please try again." })
    }
})

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
    try {
        const { email, username, identifier, password, rememberMe } = req.body

        const rawIdentifier = (identifier || email || username || "").toString().trim()

        if (!rawIdentifier) {
            return res.status(400).json({ message: "Please enter your email or username" })
        }

        if (!password || typeof password !== "string" || password.trim().length === 0) {
            return res.status(400).json({ message: "Password is required" })
        }

        const normalizedIdentifier = rawIdentifier.toLowerCase()
        let user = findUserByEmail(normalizedIdentifier)
        if (!user) {
            user = findUserByUsername(normalizedIdentifier)
        }

        if (!user) {
            return res.status(401).json({ message: "Invalid email/username or password" })
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash)
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email/username or password" })
        }

        const token = generateToken(user.id, user.email, user.username, Boolean(rememberMe))
        const safeUser = toSafeUser(user)

        return res.status(200).json({
            message: "Logged in successfully",
            token,
            user: safeUser,
        })
    } catch (error) {
        console.error("Login error:", error)
        return res.status(500).json({ message: "Unable to connect to the server. Please try again." })
    }
})

/**
 * POST /api/auth/logout
 */
router.post("/logout", (_req, res) => {
    return res.status(200).json({ message: "Logged out successfully" })
})

/**
 * GET /api/auth/me
 */
router.get("/me", authMiddleware, (req, res) => {
    return res.status(200).json({ user: req.user })
})

/**
 * PUT /api/auth/profile
 */
router.put("/profile", authMiddleware, (req, res) => {
    try {
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { name, avatar } = req.body
        const updates = {}

        if (name && typeof name === "string" && name.trim().length > 0) {
            updates.name = name.trim()
        }

        if (avatar && typeof avatar === "string" && avatar.trim().length > 0) {
            updates.avatar = avatar.trim()
        }

        const updatedUser = updateUser(userId, updates)
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" })
        }

        return res.status(200).json({
            message: "Profile updated successfully",
            user: toSafeUser(updatedUser),
        })
    } catch (error) {
        console.error("Update profile error:", error)
        return res.status(500).json({ message: "Unable to update profile. Please try again." })
    }
})

export default router
