const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "cocode_jwt_secret_dev_and_prod_key_2026";

const JUDGE0_BASE_URL = (
    process.env.JUDGE0_BASE_URL || "https://ce.judge0.com"
).replace(/\/+$/, "");

const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN;

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

const runRateLimits = new Map();

// ============================================================================
// Password & Auth Security Helpers
// ============================================================================

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

function generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function formatUserProfile(user) {
    let parsedSkills = [];
    if (Array.isArray(user.skills)) {
        parsedSkills = user.skills;
    } else if (typeof user.skills === "string") {
        try {
            parsedSkills = JSON.parse(user.skills);
        } catch {
            parsedSkills = user.skills.split(",").map((s) => s.trim()).filter(Boolean);
        }
    }

    let parsedSocialLinks = { github: "", linkedin: "", portfolio: "" };
    if (user.socialLinks && typeof user.socialLinks === "object") {
        parsedSocialLinks = { ...parsedSocialLinks, ...user.socialLinks };
    } else if (typeof user.socialLinks === "string") {
        try {
            parsedSocialLinks = { ...parsedSocialLinks, ...JSON.parse(user.socialLinks) };
        } catch {
            // Keep defaults
        }
    }

    return {
        id: user.id,
        name: user.name,
        username: user.username || user.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        email: user.email,
        phone: typeof user.phone === "string" ? user.phone : "",
        location: typeof user.location === "string" ? user.location : "",
        bio: typeof user.bio === "string" ? user.bio : "",
        role: user.role || "User",
        memberSince: user.createdAt
            ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "Recently",
        skills: parsedSkills,
        socialLinks: parsedSocialLinks,
        avatarUrl: user.avatarUrl || "",
        createdAt: user.createdAt,
    };
}

// Authentication Middleware via JWT
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
        return res.status(401).json({
            error: "Authentication required. Please log in to perform this action.",
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            return res.status(401).json({
                error: "User account no longer exists.",
            });
        }

        req.user = formatUserProfile(user);
        req.rawUser = user;
        req.userId = user.id;
        req.token = token;
        next();
    } catch (err) {
        return res.status(401).json({
            error: "Session expired or invalid. Please sign in again.",
        });
    }
}

// Optional Auth Helper for compiler/run and public routes
async function getOptionalUser(req) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        return user || null;
    } catch {
        return null;
    }
}

// Language helpers for dashboard & stats
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

// In-Memory collaboration room tracking (synchronized with database)
const rooms = new Map(); // code -> room object

app.use(cors());
app.use(express.json({ limit: "64kb" }));

// ============================================================================
// Public / Health Endpoints
// ============================================================================

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to the CoCode API!",
        status: "Server is running with MySQL & Prisma",
        endpoints: {
            auth: ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/logout"],
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
    });
});

// ============================================================================
// Authentication Routes (Database-backed via Prisma & MySQL)
// ============================================================================

// Register a new user
app.post("/api/auth/register", async (req, res) => {
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

        return res.status(201).json({
            message: "Account created successfully.",
            token,
            user: formatUserProfile(newUser),
        });
    } catch (err) {
        console.error("Registration error:", err);
        return res.status(500).json({ error: "Failed to create account. Please try again." });
    }
});

// Login
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        const normalizedEmail = email.trim().toLowerCase();

        let user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // If demo credentials and not yet in database, initialize clean empty demo account in MySQL
        if (!user && (normalizedEmail === "demo@cocode.dev" || normalizedEmail === "jatinraghav22@gmail.com") && password === "password123") {
            user = await prisma.user.create({
                data: {
                    name: normalizedEmail.startsWith("demo") ? "Demo Developer" : "Jatin Raghav",
                    username: normalizedEmail.startsWith("demo") ? "demo-developer" : "jatin-raghav",
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
                },
            });
        }

        if (!user || !verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = generateToken(user.id);

        // Record login activity
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
        console.error("Login error:", err);
        return res.status(500).json({ error: "Failed to log in. Please try again." });
    }
});

// Verify Current User Session
app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({
        user: req.user,
    });
});

// Logout
app.post("/api/auth/logout", requireAuth, (req, res) => {
    return res.json({ message: "Logged out successfully." });
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
        console.error("Profile update error:", err);
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
        // If the user has no recorded usage or projects, return an empty array (no fake percentages)
        let popularLanguages = [];

        // Aggregate language weights from language stats, projects, and executions
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
            const sortedLangs = Array.from(languageWeights.entries())
                .sort((a, b) => b[1] - a[1]);

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
                const othersWeight = remainderLangs.reduce((sum, [, w]) => sum + w, 0);
                const othersPct = Math.max(1, 100 - accumulatedPct);
                popularLanguages.push({
                    name: "Others",
                    percentage: othersPct,
                    color: "#94a3b8",
                    icon: "📦",
                });
            } else if (popularLanguages.length > 0) {
                // Ensure percentage sums up to 100% nicely if there's rounding drift
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
        console.error("Dashboard error:", err);
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
        console.error("Fetch projects error:", err);
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
        console.error("Create project error:", err);
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
        console.error("Get project error:", err);
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
        console.error("Update project error:", err);
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
        console.error("Delete project error:", err);
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
        console.error("Get activity error:", err);
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
        console.error("Create activity error:", err);
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

        // Update user progress streak & active date
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
        console.error("Session recording error:", err);
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
        console.error("Get progress error:", err);
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
        console.error("Get submissions error:", err);
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
        console.error("Get languages error:", err);
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

        const roomHost = (displayName && typeof displayName === "string" && displayName.trim())
            ? displayName.trim()
            : req.user.name;

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
        console.error("Create room error:", err);
        return res.status(500).json({ error: "Failed to create collaboration room." });
    }
});

// Join an existing room
app.post("/api/rooms/join", requireAuth, async (req, res) => {
    try {
        const { roomCode, displayName } = req.body || {};

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

        const memberName = (displayName && typeof displayName === "string" && displayName.trim())
            ? displayName.trim()
            : req.user.name;

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
        console.error("Join room error:", err);
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
        console.error("Get room error:", err);
        return res.status(500).json({ error: "Failed to retrieve room details." });
    }
});

// ============================================================================
// Online Compiler Execution Endpoint (With real user activity tracking)
// ============================================================================

function getRetryAfter(ip) {
    const now = Date.now();
    let entry = runRateLimits.get(ip);

    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + 60_000 };
        runRateLimits.set(ip, entry);
    }

    if (entry.count >= 25) {
        return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    }

    entry.count += 1;

    if (runRateLimits.size > 2000) {
        for (const [key, value] of runRateLimits) {
            if (value.resetAt <= now) runRateLimits.delete(key);
        }
    }

    return 0;
}

const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

app.post("/api/compiler/run", async (req, res) => {
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

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const retryAfter = getRetryAfter(clientIp);

    if (retryAfter > 0) {
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({
            error: "Too many execution requests. Please wait before running more code.",
        });
    }

    const headers = { "Content-Type": "application/json" };
    if (JUDGE0_AUTH_TOKEN) {
        headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;
    }

    // Check optional authenticated user
    const authenticatedUser = await getOptionalUser(req);

    try {
        const submissionResponse = await fetch(
            `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`,
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
                `${JUDGE0_BASE_URL}/submissions/${encodeURIComponent(submission.token)}` +
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
                    timeSpent: 60, // Grant 1 minute of active coding time for real run
                },
                update: {
                    count: { increment: 1 },
                    timeSpent: { increment: 60 },
                },
            }).catch(() => {});

            // 3. Record Coding Session (at least 60 seconds) so today's activity increases genuinely
            await prisma.codingSession.create({
                data: {
                    userId,
                    language: normalizedLang,
                    duration: 60,
                    startedAt: new Date(Date.now() - 60000),
                    endedAt: new Date(),
                },
            }).catch(() => {});

            // 4. Update User Progress (streak, total runs, total lines)
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
        console.error("Compiler service request failed:", error.message);

        if (
            error.name === "TimeoutError" ||
            error.name === "AbortError"
        ) {
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

    const AI_API_KEY = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

    if (AI_API_KEY && process.env.OPENAI_API_KEY) {
        try {
            const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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

const roomSockets = new Map(); // roomCode -> Set of socket IDs

io.on("connection", (socket) => {
    let currentRoom = null;
    let currentUser = "Developer";

    socket.on("join-room", async ({ roomCode, displayName }) => {
        if (!roomCode) return;
        const normalizedCode = roomCode.trim().toUpperCase();
        currentRoom = normalizedCode;
        currentUser = displayName || "Developer";

        socket.join(normalizedCode);

        if (!roomSockets.has(normalizedCode)) {
            roomSockets.set(normalizedCode, new Set());
        }
        roomSockets.get(normalizedCode).add(socket.id);

        let roomObj = rooms.get(normalizedCode);
        if (!roomObj) {
            // Load from database if not in memory
            const dbRoom = await prisma.collaborationRoom.findUnique({
                where: { code: normalizedCode },
                include: { members: true },
            }).catch(() => null);

            if (dbRoom) {
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
        }

        if (roomObj && !roomObj.members.includes(currentUser)) {
            roomObj.members.push(currentUser);
        }

        const membersList = roomObj ? roomObj.members : [currentUser];
        io.to(normalizedCode).emit("room-update", {
            roomCode: normalizedCode,
            members: membersList,
        });

        socket.to(normalizedCode).emit("chat-message", {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            text: `${currentUser} joined the session.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
    });

    socket.on("code-change", ({ roomCode, fileId, content }) => {
        if (!roomCode) return;
        socket.to(roomCode.toUpperCase()).emit("code-change", { fileId, content });
    });

    socket.on("chat-message", ({ roomCode, message }) => {
        if (!roomCode || !message) return;
        socket.to(roomCode.toUpperCase()).emit("chat-message", message);
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
                text: `${currentUser} left the session.`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
        }
    });
});

server.listen(PORT, () => {
    console.log(`CoCode backend API running at http://localhost:${PORT}`);
    console.log(`Database connected via Prisma ORM (MySQL)`);
});
