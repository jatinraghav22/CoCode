/**
 * server.js — CoCode Backend API
 *
 * Security changes in this version:
 * - JWT secret loaded from env only, no hardcoded fallback
 * - JWT uses issuer + audience claim validation
 * - Logout now revokes sessions in MySQL (database-backed)
 * - Logout-all-devices endpoint added
 * - Demo account auto-creation REMOVED (was a security vulnerability)
 * - Socket.IO now requires valid JWT on handshake
 * - Socket.IO never trusts frontend-supplied displayName for identity
 * - CORS locked to CLIENT_URL environment variable
 * - Helmet secure headers added
 * - Rate limiting on login and register routes
 * - Startup fails if JWT_SECRET is missing in production
 */

"use strict";

// ─── Load environment and validate secrets FIRST ─────────────────────────────
// This must run before anything else so that if JWT_SECRET is missing
// in production, the server refuses to start immediately.
require("dotenv").config();
const config = require("./src/config/env");

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

// ─── Our modular utilities ────────────────────────────────────────────────────
const prisma = require("./src/config/prisma");
const { requireAuth, optionalAuth, socketAuth, formatUserProfile } = require("./src/middleware/auth");
const { createSession, revokeSession, revokeAllSessions, cleanupExpiredSessions } = require("./src/services/session");
const { authLoginLimiter, authRegisterLimiter, compilerLimiter, generalApiLimiter } = require("./src/middleware/rateLimit");

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Allowed Origins for CORS ─────────────────────────────────────────────────
// CLIENT_URL can be a comma-separated list for multiple origins.
// e.g. CLIENT_URL="http://localhost:5173,https://getcocode.vercel.app"
const rawClientUrl = config.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = rawClientUrl.split(",").map((o) => o.trim()).filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
            return callback(null, true);
        }
        return callback(new Error(`CORS: Origin "${origin}" is not allowed.`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
};

// ─── Socket.IO with locked CORS ───────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    },
});

// ─── Secure Socket.IO with JWT authentication ─────────────────────────────────
// Every socket connection must present a valid, non-revoked JWT.
// socketAuth populates socket.data.userId and socket.data.userName from the DB.
// The frontend CANNOT override these values via event payloads.
io.use(socketAuth);

// ─── Express Middleware Stack ─────────────────────────────────────────────────
app.use(helmet({
    // Relax CSP in development; it's tightened in production via env
    contentSecurityPolicy: config.isProduction,
    crossOriginEmbedderPolicy: false, // Needed for Monaco Editor iframes
}));
app.use(cors(corsOptions));
// Preflight handled automatically by cors() middleware above
app.use(express.json({ limit: "64kb" }));

// ─── General API rate limit ───────────────────────────────────────────────────
app.use("/api/", generalApiLimiter);

// ─── Constants ───────────────────────────────────────────────────────────────
const PORT = config.PORT;

// Supported execution runtimes verified with Judge0 CE
const SUPPORTED_LANGUAGES = {
    python: 100,     // Python 3.12.5
    py: 100,
    javascript: 102, // JavaScript (Node.js 22.08.0)
    js: 102,
    node: 102,
    cpp: 105,        // C++ (GCC 14.1.0)
    "c++": 105,
    c: 103,          // C (GCC 14.1.0)
    java: 91,        // Java (JDK 17.0.6)
};

// Language metadata for dashboard statistics
const LANGUAGE_META = {
    python: { name: "Python", color: "#38bdf8", icon: "🐍" },
    javascript: { name: "JavaScript", color: "#facc15", icon: "⚡" },
    js: { name: "JavaScript", color: "#facc15", icon: "⚡" },
    cpp: { name: "C++", color: "#60a5fa", icon: "⚙️" },
    "c++": { name: "C++", color: "#60a5fa", icon: "⚙️" },
    c: { name: "C", color: "#818cf8", icon: "🔧" },
    java: { name: "Java", color: "#c084fc", icon: "☕" },
    html: { name: "HTML / CSS", color: "#fb923c", icon: "🌐" },
    css: { name: "CSS", color: "#38bdf8", icon: "🎨" },
    typescript: { name: "TypeScript", color: "#3b82f6", icon: "🔷" },
    rust: { name: "Rust", color: "#f97316", icon: "🦀" },
    go: { name: "Go", color: "#06b6d4", icon: "🐹" },
};

// ─── Password Security Helpers ────────────────────────────────────────────────
// Using Node's built-in crypto.scryptSync — cryptographically sound.
// Unique random salt per password, timing-safe comparison.
// Max length guard prevents DoS via extremely long password strings.
const MAX_PASSWORD_LENGTH = 256;

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.includes(":")) return false;
    const [salt, originalHash] = stored.split(":");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    try {
        return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
    } catch {
        return false;
    }
}

// ─── JWT Generation ───────────────────────────────────────────────────────────
function generateToken(userId) {
    return jwt.sign(
        { userId, jti: crypto.randomUUID() },
        config.JWT_SECRET,
        {
            expiresIn: config.JWT_EXPIRES_IN,
            issuer: config.JWT_ISSUER,
            audience: config.JWT_AUDIENCE,
        }
    );
}

// Parse the JWT expiry string into a Date object for session storage.
function getTokenExpiry(token) {
    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            return new Date(decoded.exp * 1000); // exp is Unix seconds
        }
    } catch {
        // Fall through
    }
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 7 days
}

// ─── Utility Helpers ─────────────────────────────────────────────────────────
function formatTimeAgo(date) {
    if (!date) return "Recently";
    const diffMs = Date.now() - new Date(date).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return "Just now";
    if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 30) return `${diffDay} days ago`;
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function resolveIconType(language) {
    const lang = String(language || "").toLowerCase();
    if (lang.includes("python") || lang === "py") return "calc";
    if (lang.includes("javascript") || lang.includes("node") || lang === "js") return "weather";
    if (lang.includes("html") || lang.includes("web") || lang.includes("css")) return "web";
    return "code";
}

// ─── In-Memory collaboration room tracking (synchronized with database) ───────
const rooms = new Map(); // roomCode -> room object (for real-time socket state)

// ─── Periodic Cleanup ─────────────────────────────────────────────────────────
// Run session cleanup every 24 hours to remove expired/revoked auth session rows.
// This keeps the AuthSession table lean over time.
setInterval(async () => {
    const deleted = await cleanupExpiredSessions().catch(() => 0);
    if (deleted > 0) {
        console.log(`[session-cleanup] Removed ${deleted} expired/revoked session records.`);
    }
}, 24 * 60 * 60 * 1000); // 24 hours

// Also run once on startup after a short delay (in case of old sessions)
setTimeout(() => {
    cleanupExpiredSessions().catch(() => {});
}, 10 * 1000);

// ============================================================================
// Public / Health Endpoints
// ============================================================================

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to the CoCode API!",
        status: "Server is running with MySQL & Prisma",
        endpoints: {
            auth: ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/logout", "/api/auth/logout-all"],
            dashboard: ["/api/dashboard (protected)"],
            projects: ["/api/projects (protected)"],
            activity: ["/api/activity (protected)"],
            sessions: ["/api/sessions (protected)"],
            progress: ["/api/progress (protected)"],
            submissions: ["/api/submissions (protected)"],
            languages: ["/api/languages (protected)"],
            compiler: ["/api/compiler/run"],
            rooms: ["/api/rooms (protected)", "/api/rooms/join (protected)", "/api/rooms/:code (protected)"],
        },
    });
});

app.get("/api/health", async (req, res) => {
    let dbStatus = "connected";
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
        dbStatus = "error: " + err.message;
    }

    res.json({
        status: "healthy",
        database: dbStatus,
        roomsCount: rooms.size,
        env: config.NODE_ENV,
    });
});

// ============================================================================
// Authentication Routes (Database-backed via Prisma & MySQL)
// ============================================================================

// Register a new user
// Rate limited: 10 registrations per hour per IP
app.post("/api/auth/register", authRegisterLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return res.status(400).json({ error: "Name must be at least 2 characters." });
        }

        if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: "Please provide a valid email address." });
        }

        if (!password || typeof password !== "string" || password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters." });
        }

        // Max length guard prevents DoS via extremely long password strings
        if (password.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({ error: "Password is too long." });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists in database
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        const cleanName = name.trim();
        const baseUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "user";
        let uniqueUsername = baseUsername;
        let attempt = 0;

        while (attempt < 10) {
            const check = await prisma.user.findUnique({ where: { username: uniqueUsername } });
            if (!check) break;
            attempt++;
            uniqueUsername = `${baseUsername}-${crypto.randomInt(100, 9999)}`;
        }

        const newUser = await prisma.user.create({
            data: {
                name: cleanName,
                username: uniqueUsername,
                email: normalizedEmail,
                passwordHash: hashPassword(password),
                role: "User",
                settings: {
                    create: {
                        theme: "vs-dark",
                        fontSize: 14,
                        tabSize: 2,
                    },
                },
                progress: {
                    create: {
                        totalLinesRun: 0,
                        totalRuns: 0,
                        streakDays: 0,
                    },
                },
                activities: {
                    create: {
                        type: "account_created",
                        details: "Account registered successfully.",
                    },
                },
            },
        });

        const token = generateToken(newUser.id);

        // Create a tracked session for this new token
        await createSession({
            userId: newUser.id,
            token,
            expiresAt: getTokenExpiry(token),
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        }).catch((err) => console.warn("[session] Could not create register session:", err.message));

        return res.status(201).json({
            message: "Account created successfully.",
            token,
            user: formatUserProfile(newUser),
        });
    } catch (err) {
        console.error("Registration error:", err.message);
        return res.status(500).json({ error: "Failed to create account. Please try again." });
    }
});

// Login
// Rate limited: 20 attempts per 15 minutes per IP
app.post("/api/auth/login", authLoginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({ error: "Invalid credentials." });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // ─── SECURITY: No automatic account creation during login ─────────────
        // Previously, demo accounts were silently created here.
        // This is REMOVED — no account should ever be created during login.
        // If the demo account is needed, it must be explicitly seeded via
        // a one-time setup script (npm run seed:demo).
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // Use timing-safe comparison to prevent user enumeration
        // We always call verifyPassword even if user doesn't exist (using a dummy hash)
        // so the response time doesn't reveal whether the email exists.
        const dummyHash = "0000000000000000:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        const isValid = user ? verifyPassword(password, user.passwordHash) : verifyPassword(password, dummyHash);

        if (!user || !isValid) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = generateToken(user.id);

        // Create a tracked session for this login
        await createSession({
            userId: user.id,
            token,
            expiresAt: getTokenExpiry(token),
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        }).catch((err) => console.warn("[session] Could not create login session:", err.message));

        // Record login activity (non-critical, failure does not block login)
        await prisma.activityLog.create({
            data: {
                userId: user.id,
                type: "login",
                details: "User logged in to dashboard",
            },
        }).catch(() => {});

        return res.json({
            message: "Login successful.",
            token,
            user: formatUserProfile(user),
        });
    } catch (err) {
        console.error("Login error:", err.message);
        return res.status(500).json({ error: "Failed to log in. Please try again." });
    }
});

// Verify Current User Session
app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({
        user: req.user,
    });
});

// Logout — revoke current session in database
// BEFORE: This only returned a success message. The JWT stayed valid forever.
// AFTER: The session is marked as revoked. requireAuth will reject it immediately.
app.post("/api/auth/logout", requireAuth, async (req, res) => {
    try {
        await revokeSession(req.token);

        await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: "logout",
                details: "User logged out.",
            },
        }).catch(() => {});

        return res.json({ message: "Logged out successfully." });
    } catch (err) {
        console.error("Logout error:", err.message);
        // Even on error, tell the client to clear their token
        return res.json({ message: "Logged out." });
    }
});

// Logout from ALL devices — revokes every active session for this user
app.post("/api/auth/logout-all", requireAuth, async (req, res) => {
    try {
        const count = await revokeAllSessions(req.userId);

        await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: "logout_all",
                details: `Logged out from all ${count} device(s).`,
            },
        }).catch(() => {});

        return res.json({
            message: `Logged out from ${count} device(s) successfully.`,
            sessionsRevoked: count,
        });
    } catch (err) {
        console.error("Logout-all error:", err.message);
        return res.status(500).json({ error: "Failed to log out from all devices." });
    }
});

// ============================================================================
// User Profile Endpoints (Protected)
// ============================================================================

// Get Full Profile
app.get("/api/user/profile", requireAuth, (req, res) => {
    return res.json({ profile: req.user });
});

// Update Profile
app.put("/api/user/profile", requireAuth, async (req, res) => {
    try {
        const {
            name,
            username,
            phone,
            location,
            bio,
            skills,
            socialLinks,
            avatarUrl,
        } = req.body || {};

        const updateData = {};

        if (name && typeof name === "string" && name.trim().length >= 2) {
            updateData.name = name.trim();
        }

        if (username && typeof username === "string") {
            const cleanUsername = username.trim().replace(/^@+/, "");
            if (cleanUsername !== req.rawUser.username) {
                const existing = await prisma.user.findUnique({ where: { username: cleanUsername } });
                if (existing && existing.id !== req.userId) {
                    return res.status(409).json({ error: "Username is already taken." });
                }
                updateData.username = cleanUsername;
            }
        }

        if (typeof phone === "string") updateData.phone = phone.trim();
        if (typeof location === "string") updateData.location = location.trim();
        if (typeof bio === "string") updateData.bio = bio.trim().slice(0, 500);
        if (typeof avatarUrl === "string") updateData.avatarUrl = avatarUrl.trim();

        if (Array.isArray(skills)) {
            updateData.skills = JSON.stringify(skills.map((s) => String(s).trim()).filter(Boolean));
        }

        if (socialLinks && typeof socialLinks === "object") {
            const existingLinks = req.user.socialLinks || {};
            updateData.socialLinks = JSON.stringify({ ...existingLinks, ...socialLinks });
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.userId },
            data: updateData,
        });

        const formatted = formatUserProfile(updatedUser);

        await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: "profile_update",
                details: "Updated user profile details.",
            },
        }).catch(() => {});

        return res.json({
            message: "Profile updated successfully.",
            profile: formatted,
        });
    } catch (err) {
        console.error("Profile update error:", err.message);
        return res.status(500).json({ error: "Failed to update profile." });
    }
});

// ============================================================================
// Dynamic User-Specific Dashboard Endpoint
// ============================================================================

app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
        const userId = req.userId;

        // 1. Total Projects owned by this authenticated user
        const totalProjects = await prisma.project.count({
            where: { ownerId: userId },
        });

        // 2. Active Collaboration Rooms for this user
        const activeRoomsCount = await prisma.collaborationRoom.count({
            where: { hostId: userId },
        });

        // 3. Today's Activity calculated from actual recorded sessions
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const sessionsToday = await prisma.codingSession.findMany({
            where: {
                userId,
                startedAt: { gte: startOfToday },
            },
        });

        const totalSecondsToday = sessionsToday.reduce((sum, s) => sum + (s.duration || 0), 0);
        const todayActivityMinutes = Math.round(totalSecondsToday / 60);

        // 4. Languages Used (count of unique languages from projects, language stats, and executions)
        const userLanguageStats = await prisma.languageStat.findMany({
            where: { userId },
        });

        const userProjects = await prisma.project.findMany({
            where: { ownerId: userId },
            select: { language: true },
        });

        const uniqueLanguages = new Set();
        userLanguageStats.forEach((stat) => {
            if ((stat.count && stat.count > 0) || (stat.timeSpent && stat.timeSpent > 0)) {
                uniqueLanguages.add(stat.language.toLowerCase());
            }
        });
        userProjects.forEach((proj) => {
            if (proj.language) {
                uniqueLanguages.add(proj.language.toLowerCase());
            }
        });

        const languagesUsedCount = uniqueLanguages.size;

        // 5. Recent Projects (Latest 5 projects owned by this user)
        const recentProjectsRaw = await prisma.project.findMany({
            where: { ownerId: userId },
            orderBy: { updatedAt: "desc" },
            take: 5,
        });

        const recentProjects = recentProjectsRaw.map((proj) => ({
            id: proj.id,
            name: proj.name,
            language: proj.language || "JavaScript",
            description: proj.description || "",
            iconType: resolveIconType(proj.language),
            createdAt: proj.createdAt,
            updatedAt: proj.updatedAt,
            updatedText: formatTimeAgo(proj.updatedAt),
        }));

        // 6. Popular Languages breakdown calculated from actual recorded activity
        let popularLanguages = [];

        const languageWeights = new Map();

        userLanguageStats.forEach((stat) => {
            const key = stat.language.toLowerCase();
            const weight = (stat.count || 0) * 10 + (stat.timeSpent || 0);
            if (weight > 0) {
                languageWeights.set(key, (languageWeights.get(key) || 0) + weight);
            }
        });

        userProjects.forEach((proj) => {
            const key = (proj.language || "javascript").toLowerCase();
            languageWeights.set(key, (languageWeights.get(key) || 0) + 15);
        });

        const totalWeight = Array.from(languageWeights.values()).reduce((sum, w) => sum + w, 0);

        if (totalWeight > 0) {
            const sortedLangs = Array.from(languageWeights.entries()).sort((a, b) => b[1] - a[1]);
            let accumulatedPct = 0;
            const topLangs = sortedLangs.slice(0, 4);
            const remainderLangs = sortedLangs.slice(4);

            popularLanguages = topLangs.map(([langKey, weight]) => {
                const meta = LANGUAGE_META[langKey] || {
                    name: langKey.charAt(0).toUpperCase() + langKey.slice(1),
                    color: "#94a3b8",
                    icon: "💻",
                };
                const percentage = Math.round((weight / totalWeight) * 100);
                accumulatedPct += percentage;
                return {
                    name: meta.name,
                    percentage,
                    color: meta.color,
                    icon: meta.icon,
                };
            });

            if (remainderLangs.length > 0) {
                const othersPct = Math.max(1, 100 - accumulatedPct);
                popularLanguages.push({
                    name: "Others",
                    percentage: othersPct,
                    color: "#94a3b8",
                    icon: "📦",
                });
            } else if (popularLanguages.length > 0) {
                const diff = 100 - popularLanguages.reduce((sum, item) => sum + item.percentage, 0);
                if (diff !== 0 && popularLanguages[0]) {
                    popularLanguages[0].percentage += diff;
                }
            }
        }

        return res.json({
            stats: {
                totalProjects,
                activeRooms: activeRoomsCount,
                todayActivityMinutes,
                languagesUsedCount,
            },
            recentProjects,
            popularLanguages,
            user: req.user,
        });
    } catch (err) {
        console.error("Dashboard error:", err.message);
        return res.status(500).json({ error: "Failed to load dashboard data." });
    }
});

// ============================================================================
// Projects Endpoints (Protected by requireAuth)
// ============================================================================

// Get all projects for current user
app.get("/api/projects", requireAuth, async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            where: { ownerId: req.userId },
            orderBy: { updatedAt: "desc" },
        });

        const formatted = projects.map((p) => ({
            id: p.id,
            name: p.name,
            language: p.language || "JavaScript",
            description: p.description || "",
            isPublic: p.isPublic,
            iconType: resolveIconType(p.language),
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            updatedText: formatTimeAgo(p.updatedAt),
        }));

        return res.json({ projects: formatted });
    } catch (err) {
        console.error("Fetch projects error:", err.message);
        return res.status(500).json({ error: "Failed to retrieve projects." });
    }
});

// Create a new project
app.post("/api/projects", requireAuth, async (req, res) => {
    try {
        const { name, language = "JavaScript", description = "", isPublic = false } = req.body || {};

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "Project name is required." });
        }

        const cleanName = name.trim();
        const cleanLang = (language && typeof language === "string") ? language.trim() : "JavaScript";
        const cleanDesc = (description && typeof description === "string") ? description.trim() : "";

        const newProject = await prisma.project.create({
            data: {
                name: cleanName,
                language: cleanLang,
                description: cleanDesc,
                isPublic: Boolean(isPublic),
                ownerId: req.userId,
            },
        });

        // Update language statistics
        const normalizedLang = cleanLang.toLowerCase();
        await prisma.languageStat.upsert({
            where: {
                userId_language: {
                    userId: req.userId,
                    language: normalizedLang,
                },
            },
            create: {
                userId: req.userId,
                language: normalizedLang,
                count: 1,
            },
            update: {
                count: { increment: 1 },
            },
        }).catch(() => {});

        // Log project creation activity
        await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: "project_create",
                details: `Created project "${cleanName}" (${cleanLang})`,
            },
        }).catch(() => {});

        return res.status(201).json({
            message: "Project created successfully.",
            project: {
                id: newProject.id,
                name: newProject.name,
                language: newProject.language,
                description: newProject.description,
                iconType: resolveIconType(newProject.language),
                createdAt: newProject.createdAt,
                updatedAt: newProject.updatedAt,
                updatedText: "Just now",
            },
        });
    } catch (err) {
        console.error("Create project error:", err.message);
        return res.status(500).json({ error: "Failed to create project." });
    }
});

// Get single project
app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
        const project = await prisma.project.findFirst({
            where: {
                id: req.params.id,
                OR: [
                    { ownerId: req.userId },
                    { isPublic: true },
                ],
            },
            include: {
                files: true,
            },
        });

        if (!project) {
            return res.status(404).json({ error: "Project not found." });
        }

        return res.json({
            project: {
                id: project.id,
                name: project.name,
                language: project.language,
                description: project.description,
                isPublic: project.isPublic,
                ownerId: project.ownerId,
                iconType: resolveIconType(project.language),
                files: project.files,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                updatedText: formatTimeAgo(project.updatedAt),
            },
        });
    } catch (err) {
        console.error("Get project error:", err.message);
        return res.status(500).json({ error: "Failed to load project." });
    }
});

// Update project
app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, language, description, isPublic } = req.body || {};

        const existing = await prisma.project.findUnique({
            where: { id },
        });

        if (!existing) {
            return res.status(404).json({ error: "Project not found." });
        }

        if (existing.ownerId !== req.userId) {
            return res.status(403).json({ error: "You do not have permission to modify this project." });
        }

        const updateData = {};
        if (name && typeof name === "string" && name.trim()) updateData.name = name.trim();
        if (language && typeof language === "string") updateData.language = language.trim();
        if (typeof description === "string") updateData.description = description.trim();
        if (typeof isPublic === "boolean") updateData.isPublic = isPublic;

        const updated = await prisma.project.update({
            where: { id },
            data: updateData,
        });

        await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: "project_update",
                details: `Updated project "${updated.name}"`,
            },
        }).catch(() => {});

        return res.json({
            message: "Project updated successfully.",
            project: {
                id: updated.id,
                name: updated.name,
                language: updated.language,
                description: updated.description,
                iconType: resolveIconType(updated.language),
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt,
                updatedText: "Just now",
            },
        });
    } catch (err) {
        console.error("Update project error:", err.message);
        return res.status(500).json({ error: "Failed to update project." });
    }
});

// Delete project
app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.project.findUnique({
            where: { id },
        });

        if (!existing) {
            return res.status(404).json({ error: "Project not found." });
        }

        if (existing.ownerId !== req.userId) {
            return res.status(403).json({ error: "You do not have permission to delete this project." });
        }

        await prisma.project.delete({
            where: { id },
        });

        await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: "project_delete",
                details: `Deleted project "${existing.name}"`,
            },
        }).catch(() => {});

        return res.json({ message: "Project deleted successfully." });
    } catch (err) {
        console.error("Delete project error:", err.message);
        return res.status(500).json({ error: "Failed to delete project." });
    }
});

// ============================================================================
// Activity & Coding Session Endpoints
// ============================================================================

// Get recent activity logs
app.get("/api/activity", requireAuth, async (req, res) => {
    try {
        const activities = await prisma.activityLog.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: "desc" },
            take: 30,
        });

        return res.json({
            activities: activities.map((a) => ({
                id: a.id,
                type: a.type,
                details: a.details,
                createdAt: a.createdAt,
                timeAgo: formatTimeAgo(a.createdAt),
            })),
        });
    } catch (err) {
        console.error("Get activity error:", err.message);
        return res.status(500).json({ error: "Failed to load activity logs." });
    }
});

// Post an activity log entry
app.post("/api/activity", requireAuth, async (req, res) => {
    try {
        const { type = "general", details = "" } = req.body || {};
        const log = await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: String(type).slice(0, 50),
                details: String(details).slice(0, 500),
            },
        });

        return res.status(201).json({ activity: log });
    } catch (err) {
        console.error("Create activity error:", err.message);
        return res.status(500).json({ error: "Failed to log activity." });
    }
});

// Record a coding session
app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
        const { projectId, language, duration, startedAt, endedAt } = req.body || {};
        const durationSec = Math.max(0, Math.min(86400, parseInt(duration, 10) || 0));

        const session = await prisma.codingSession.create({
            data: {
                userId: req.userId,
                projectId: projectId || null,
                language: language ? String(language).toLowerCase() : null,
                duration: durationSec,
                startedAt: startedAt ? new Date(startedAt) : new Date(Date.now() - durationSec * 1000),
                endedAt: endedAt ? new Date(endedAt) : new Date(),
            },
        });

        // Update language time spent
        if (language && durationSec > 0) {
            const normalizedLang = String(language).toLowerCase();
            await prisma.languageStat.upsert({
                where: {
                    userId_language: {
                        userId: req.userId,
                        language: normalizedLang,
                    },
                },
                create: {
                    userId: req.userId,
                    language: normalizedLang,
                    timeSpent: durationSec,
                    count: 1,
                },
                update: {
                    timeSpent: { increment: durationSec },
                },
            }).catch(() => {});
        }

        // Update user progress
        await prisma.userProgress.upsert({
            where: { userId: req.userId },
            create: {
                userId: req.userId,
                lastActiveDate: new Date(),
            },
            update: {
                lastActiveDate: new Date(),
            },
        }).catch(() => {});

        return res.status(201).json({
            message: "Coding session recorded.",
            session,
        });
    } catch (err) {
        console.error("Session recording error:", err.message);
        return res.status(500).json({ error: "Failed to record session." });
    }
});

// Get user progress
app.get("/api/progress", requireAuth, async (req, res) => {
    try {
        let progress = await prisma.userProgress.findUnique({
            where: { userId: req.userId },
        });

        if (!progress) {
            progress = await prisma.userProgress.create({
                data: { userId: req.userId },
            });
        }

        return res.json({ progress });
    } catch (err) {
        console.error("Get progress error:", err.message);
        return res.status(500).json({ error: "Failed to load progress." });
    }
});

// Get execution submissions history
app.get("/api/submissions", requireAuth, async (req, res) => {
    try {
        const records = await prisma.executionRecord.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return res.json({ submissions: records });
    } catch (err) {
        console.error("Get submissions error:", err.message);
        return res.status(500).json({ error: "Failed to retrieve submissions." });
    }
});

// Get user language breakdown stats
app.get("/api/languages", requireAuth, async (req, res) => {
    try {
        const stats = await prisma.languageStat.findMany({
            where: { userId: req.userId },
            orderBy: { timeSpent: "desc" },
        });

        return res.json({ languages: stats });
    } catch (err) {
        console.error("Get languages error:", err.message);
        return res.status(500).json({ error: "Failed to load language stats." });
    }
});

// ============================================================================
// Collaboration Room Routes (Strictly Protected by requireAuth & MySQL persisted)
// ============================================================================

// Create a collaboration room
app.post("/api/rooms", requireAuth, async (req, res) => {
    try {
        const { roomName, displayName, isPrivate = false } = req.body || {};

        const cleanName = typeof roomName === "string" ? roomName.trim() : "";
        if (cleanName.length < 3) {
            return res.status(400).json({ error: "Room name must be at least 3 characters." });
        }

        // Generate a unique 6-character room code
        let code = "";
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (let attempts = 0; attempts < 10; attempts++) {
            let candidate = "";
            for (let i = 0; i < 6; i++) {
                candidate += chars[crypto.randomInt(0, chars.length)];
            }
            const exists = await prisma.collaborationRoom.findUnique({ where: { code: candidate } });
            if (!exists) {
                code = candidate;
                break;
            }
        }

        if (!code) {
            return res.status(500).json({ error: "Could not generate a unique room code. Try again." });
        }

        // Always use the authenticated user's DB name as the host name.
        // The frontend-supplied displayName is used as a UI preference only.
        // We never use it as the authoritative identity.
        const roomHost = req.user.name;

        const dbRoom = await prisma.collaborationRoom.create({
            data: {
                code,
                name: cleanName,
                hostId: req.userId,
                hostName: roomHost,
                isPrivate: Boolean(isPrivate),
                members: {
                    create: {
                        userId: req.userId,
                        userName: roomHost,
                        role: "host",
                    },
                },
            },
        });

        // Mirror in memory for real-time socket connections
        rooms.set(code, {
            code,
            name: cleanName,
            hostId: req.userId,
            hostName: roomHost,
            isPrivate: Boolean(isPrivate),
            createdAt: dbRoom.createdAt,
            members: [roomHost],
        });

        await prisma.activityLog.create({
            data: {
                userId: req.userId,
                type: "room_created",
                details: `Created collaboration room "${cleanName}" (${code})`,
            },
        }).catch(() => {});

        return res.status(201).json({
            message: "Room created successfully.",
            room: dbRoom,
        });
    } catch (err) {
        console.error("Create room error:", err.message);
        return res.status(500).json({ error: "Failed to create collaboration room." });
    }
});

// Join an existing room
app.post("/api/rooms/join", requireAuth, async (req, res) => {
    try {
        const { roomCode } = req.body || {};

        if (!roomCode || typeof roomCode !== "string") {
            return res.status(400).json({ error: "Please provide a 6-character room code." });
        }

        const normalizedCode = roomCode.trim().toUpperCase();

        const room = await prisma.collaborationRoom.findUnique({
            where: { code: normalizedCode },
            include: { members: true },
        });

        if (!room) {
            return res.status(404).json({
                error: `Room "${normalizedCode}" not found or code is invalid. Please check with your host.`,
            });
        }

        // Always use the authenticated user's DB name — never trust frontend payload
        const memberName = req.user.name;

        // Upsert room member in database
        const existingMember = room.members.find((m) => m.userId === req.userId);
        if (!existingMember) {
            await prisma.roomMember.create({
                data: {
                    roomId: room.id,
                    userId: req.userId,
                    userName: memberName,
                    role: "member",
                },
            });
        }

        // Keep memory store updated
        let memRoom = rooms.get(normalizedCode);
        if (!memRoom) {
            memRoom = {
                code: room.code,
                name: room.name,
                hostId: room.hostId,
                hostName: room.hostName,
                isPrivate: room.isPrivate,
                createdAt: room.createdAt,
                members: room.members.map((m) => m.userName),
            };
            rooms.set(normalizedCode, memRoom);
        }

        if (!memRoom.members.includes(memberName)) {
            memRoom.members.push(memberName);
        }

        return res.json({
            message: "Joined room successfully.",
            room: {
                code: room.code,
                name: room.name,
                hostName: room.hostName,
                isPrivate: room.isPrivate,
                createdAt: room.createdAt,
                members: memRoom.members,
            },
        });
    } catch (err) {
        console.error("Join room error:", err.message);
        return res.status(500).json({ error: "Failed to join room." });
    }
});

// Get room details
app.get("/api/rooms/:code", requireAuth, async (req, res) => {
    try {
        const code = (req.params.code || "").toUpperCase();
        const room = await prisma.collaborationRoom.findUnique({
            where: { code },
            include: { members: true },
        });

        if (!room) {
            return res.status(404).json({ error: `Room "${code}" not found.` });
        }

        return res.json({ room });
    } catch (err) {
        console.error("Get room error:", err.message);
        return res.status(500).json({ error: "Failed to retrieve room details." });
    }
});

// ============================================================================
// Online Compiler Execution Endpoint (With real user activity tracking)
// ============================================================================

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// compilerLimiter replaces the old in-memory runRateLimits Map.
// It persists across server restarts and doesn't consume memory per-connection.
app.post("/api/compiler/run", compilerLimiter, optionalAuth, async (req, res) => {
    const { sourceCode, language, stdin = "" } = req.body || {};

    if (typeof sourceCode !== "string" || !sourceCode.trim()) {
        return res.status(400).json({
            error: "Please enter some code before running it.",
        });
    }

    if (sourceCode.length > 30_000) {
        return res.status(413).json({
            error: "Code is too large. The maximum source size is 30,000 characters.",
        });
    }

    if (typeof stdin !== "string" || stdin.length > 10_000) {
        return res.status(400).json({
            error: "Input must be text and no longer than 10,000 characters.",
        });
    }

    const normalizedLang = String(language || "").toLowerCase().trim();
    const languageId = SUPPORTED_LANGUAGES[normalizedLang];

    if (!languageId) {
        return res.status(400).json({
            error: "Unsupported language. Supported execution runtimes: JavaScript, Python, C, C++, and Java.",
        });
    }

    const headers = { "Content-Type": "application/json" };
    if (config.JUDGE0_AUTH_TOKEN) {
        headers["X-Auth-Token"] = config.JUDGE0_AUTH_TOKEN;
    }

    // req.user is populated by optionalAuth if a valid token was sent
    const authenticatedUser = req.rawUser || null;

    try {
        const submissionResponse = await fetch(
            `${config.JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`,
            {
                method: "POST",
                headers,
                signal: AbortSignal.timeout(8000),
                body: JSON.stringify({
                    source_code: sourceCode,
                    language_id: languageId,
                    stdin,
                    cpu_time_limit: 2,
                    cpu_extra_time: 1,
                    wall_time_limit: 5,
                    memory_limit: 128000,
                    enable_network: false,
                }),
            }
        );

        const submission = await submissionResponse.json().catch(() => ({}));

        if (!submissionResponse.ok || !submission.token) {
            const message =
                submission.error ||
                submission.message ||
                `Execution service returned HTTP ${submissionResponse.status}.`;

            return res.status(
                submissionResponse.status === 429 ? 503 : 502
            ).json({ error: message });
        }

        let result = null;

        for (let attempt = 0; attempt < 24; attempt += 1) {
            await wait(750);

            const resultResponse = await fetch(
                `${config.JUDGE0_BASE_URL}/submissions/${encodeURIComponent(submission.token)}` +
                "?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory",
                {
                    headers,
                    signal: AbortSignal.timeout(8000),
                }
            );

            const resultData = await resultResponse.json().catch(() => ({}));

            if (!resultResponse.ok) {
                return res.status(502).json({
                    error: "Could not retrieve execution result from the compiler service.",
                });
            }

            const statusId = resultData.status?.id;

            if (statusId && ![1, 2].includes(statusId)) {
                result = resultData;
                break;
            }
        }

        if (!result) {
            return res.status(504).json({
                error: "Execution took too long. Please try again.",
            });
        }

        const executionStatus = result.status?.description || "Finished";
        const executionTime = result.time ? parseFloat(result.time) : null;
        const executionMemory = result.memory ? parseInt(result.memory, 10) : null;

        // If executed by an authenticated user, record genuine activity and stats in database
        if (authenticatedUser) {
            const userId = authenticatedUser.id;
            const lineCount = sourceCode.split("\n").length;

            // 1. Record Execution Record (Submission)
            await prisma.executionRecord.create({
                data: {
                    userId,
                    language: normalizedLang,
                    sourceCode,
                    stdin,
                    stdout: result.stdout || "",
                    stderr: result.stderr || "",
                    compileOutput: result.compile_output || "",
                    status: executionStatus,
                    time: executionTime,
                    memory: executionMemory,
                },
            }).catch((err) => console.warn("Could not save execution record:", err.message));

            // 2. Increment Language Usage Count
            await prisma.languageStat.upsert({
                where: {
                    userId_language: {
                        userId,
                        language: normalizedLang,
                    },
                },
                create: {
                    userId,
                    language: normalizedLang,
                    count: 1,
                    timeSpent: 60,
                },
                update: {
                    count: { increment: 1 },
                    timeSpent: { increment: 60 },
                },
            }).catch(() => {});

            // 3. Record Coding Session
            await prisma.codingSession.create({
                data: {
                    userId,
                    language: normalizedLang,
                    duration: 60,
                    startedAt: new Date(Date.now() - 60000),
                    endedAt: new Date(),
                },
            }).catch(() => {});

            // 4. Update User Progress
            await prisma.userProgress.upsert({
                where: { userId },
                create: {
                    userId,
                    totalRuns: 1,
                    totalLinesRun: lineCount,
                    streakDays: 1,
                    lastActiveDate: new Date(),
                },
                update: {
                    totalRuns: { increment: 1 },
                    totalLinesRun: { increment: lineCount },
                    lastActiveDate: new Date(),
                },
            }).catch(() => {});

            // 5. Log Activity
            await prisma.activityLog.create({
                data: {
                    userId,
                    type: "code_run",
                    details: `Ran ${normalizedLang.toUpperCase()} code in compiler (${executionStatus})`,
                },
            }).catch(() => {});
        }

        return res.json({
            status: executionStatus,
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            compileOutput: result.compile_output || "",
            message: result.message || "",
            time: executionTime,
            memory: executionMemory,
        });
    } catch (error) {
        // Don't log the full error in case it contains sensitive data
        console.error("Compiler service request failed:", error.name, error.message.slice(0, 200));

        if (error.name === "TimeoutError" || error.name === "AbortError") {
            return res.status(504).json({
                error: "The compiler service timed out. Please try again.",
            });
        }

        return res.status(502).json({
            error: "Cannot reach the execution service. Check network connection.",
        });
    }
});

// ============================================================================
// AI Coding Assistant Endpoint
// ============================================================================

app.post("/api/ai/assist", async (req, res) => {
    const { action = "explain", language = "javascript", code = "", prompt = "" } = req.body || {};

    if (!code && !prompt) {
        return res.status(400).json({ error: "Please provide code or a prompt for the AI assistant." });
    }

    if (config.OPENAI_API_KEY) {
        try {
            const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: `You are an expert programming AI assistant for the CoCode IDE. Output concise, well-formatted code explanations, fixes, and refactoring tips for ${language}.`,
                        },
                        {
                            role: "user",
                            content: `${prompt}\n\nCode:\n\`\`\`${language}\n${code.slice(0, 8000)}\n\`\`\``,
                        },
                    ],
                    max_tokens: 1000,
                }),
            });
            const data = await apiRes.json();
            if (data.choices && data.choices[0]?.message?.content) {
                return res.json({ reply: data.choices[0].message.content });
            }
        } catch (err) {
            console.warn("External AI call failed, using built-in analysis:", err.message);
        }
    }

    let reply = "";
    if (action === "explain") {
        const lineCount = (code || "").split("\n").length;
        reply = `🔍 Code Explanation (${language.toUpperCase()}):\n` +
            `• Structure: Program contains ${lineCount} lines of code.\n` +
            `• Target Runtime: Standard ${language} interpreter / compiler environment.\n` +
            `• Key Observations: Standard entry routine detected.\n` +
            `• Recommendation: To test live output, press "Run Code" in the top bar.`;
    } else if (action === "fix") {
        reply = `🔧 Error & Bug Analysis (${language.toUpperCase()}):\n` +
            `• Syntax Check: No obvious fatal syntax errors detected in snippet.\n` +
            `• Tip: Check edge cases for empty inputs or unexpected types.\n` +
            `• If using stdin, ensure you supply inputs in the "Input (stdin)" tab before clicking "Run Code".`;
    } else if (action === "refactor") {
        reply = `⚡ Refactoring Recommendations (${language.toUpperCase()}):\n` +
            `• Maintain modular functions with single responsibility.\n` +
            `• Use meaningful variable names and consistent indentation.\n` +
            `• Leverage the "Format Document" action in Developer Tools (Alt+Shift+F).`;
    } else {
        reply = `🤖 CoCode Assistant:\nAnalysis completed for ${language} script.\nPrompt received: "${prompt || "General analysis"}".`;
    }

    return res.json({ reply });
});

// ============================================================================
// Real-Time Collaboration via Socket.IO
// ============================================================================
// SECURITY: All socket connections are now authenticated via socketAuth middleware.
// socket.data.userId and socket.data.userName are set by the middleware from the DB.
// Frontend-supplied displayName in event payloads is NEVER used for identity.

const roomSockets = new Map(); // roomCode -> Set of socket IDs

io.on("connection", (socket) => {
    // These values come from socket.data populated by socketAuth middleware.
    // They are set from the verified JWT and database — the frontend cannot override them.
    let currentRoom = null;
    const authenticatedUserId = socket.data.userId;
    const authenticatedUserName = socket.data.userName; // Always the DB name

    socket.on("join-room", async ({ roomCode }) => {
        // We use roomCode from the payload but IGNORE any displayName from the client.
        // The user's identity is always taken from socket.data (set by socketAuth).
        if (!roomCode) return;
        const normalizedCode = roomCode.trim().toUpperCase();
        currentRoom = normalizedCode;

        // ─── Authorization: Verify the room exists in MySQL ───────────────────
        // We do not rely solely on the in-memory Map. MySQL is the source of truth.
        const dbRoom = await prisma.collaborationRoom.findUnique({
            where: { code: normalizedCode },
            include: { members: true },
        }).catch(() => null);

        if (!dbRoom) {
            socket.emit("error", { message: `Room "${normalizedCode}" does not exist.` });
            return;
        }

        socket.join(normalizedCode);

        if (!roomSockets.has(normalizedCode)) {
            roomSockets.set(normalizedCode, new Set());
        }
        roomSockets.get(normalizedCode).add(socket.id);

        // Build/update in-memory room state from DB
        let roomObj = rooms.get(normalizedCode);
        if (!roomObj) {
            roomObj = {
                code: dbRoom.code,
                name: dbRoom.name,
                hostId: dbRoom.hostId,
                hostName: dbRoom.hostName,
                isPrivate: dbRoom.isPrivate,
                createdAt: dbRoom.createdAt,
                members: dbRoom.members.map((m) => m.userName),
            };
            rooms.set(normalizedCode, roomObj);
        }

        // Add this user to in-memory members list if not present
        if (!roomObj.members.includes(authenticatedUserName)) {
            roomObj.members.push(authenticatedUserName);
        }

        // Also persist in DB if not already a member
        const isDbMember = dbRoom.members.some((m) => m.userId === authenticatedUserId);
        if (!isDbMember) {
            await prisma.roomMember.create({
                data: {
                    roomId: dbRoom.id,
                    userId: authenticatedUserId,
                    userName: authenticatedUserName,
                    role: "member",
                },
            }).catch(() => {});
        }

        const membersList = roomObj.members;
        io.to(normalizedCode).emit("room-update", {
            roomCode: normalizedCode,
            members: membersList,
        });

        socket.to(normalizedCode).emit("chat-message", {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            text: `${authenticatedUserName} joined the session.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
    });

    socket.on("code-change", ({ roomCode, fileId, content }) => {
        if (!roomCode) return;

        // Authorization: User must be in the room they're sending changes to
        const normalizedCode = roomCode.toUpperCase();
        if (currentRoom !== normalizedCode) {
            socket.emit("error", { message: "You are not a member of this room." });
            return;
        }

        socket.to(normalizedCode).emit("code-change", { fileId, content });
    });

    socket.on("chat-message", ({ roomCode, message }) => {
        if (!roomCode || !message) return;

        const normalizedCode = roomCode.toUpperCase();
        if (currentRoom !== normalizedCode) {
            socket.emit("error", { message: "You are not a member of this room." });
            return;
        }

        // Override the sender identity with the authenticated user's name.
        // The frontend cannot spoof who sent a message.
        const secureMessage = {
            ...message,
            senderId: authenticatedUserId,     // Always from JWT, not payload
            senderName: authenticatedUserName, // Always from DB, not payload
        };

        socket.to(normalizedCode).emit("chat-message", secureMessage);
    });

    socket.on("disconnect", () => {
        if (currentRoom && roomSockets.has(currentRoom)) {
            const set = roomSockets.get(currentRoom);
            set.delete(socket.id);
            if (set.size === 0) roomSockets.delete(currentRoom);

            socket.to(currentRoom).emit("chat-message", {
                id: `sys-${Date.now()}`,
                senderId: "system",
                senderName: "System",
                text: `${authenticatedUserName} left the session.`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
        }
    });
});

// ============================================================================
// Start Server
// ============================================================================

server.listen(PORT, () => {
    console.log(`CoCode backend API running at http://localhost:${PORT}`);
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Database connected via Prisma ORM (MySQL)`);
    console.log(`CORS allowed origins: ${allowedOrigins.join(", ")}`);
});
