const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const JUDGE0_BASE_URL = (
    process.env.JUDGE0_BASE_URL || "https://ce.judge0.com"
).replace(/\/+$/, "");

const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN;

// Language IDs verified against the current official Judge0 CE language list.
const SUPPORTED_LANGUAGES = {
    python: 100,     // Python 3.12.5
    javascript: 102, // JavaScript (Node.js 22.08.0)
    cpp: 105,        // C++ (GCC 14.1.0)
};

const runRateLimits = new Map();

// ============================================================================
// Security & Authentication Helpers (Node.js Crypto)
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

// ============================================================================
// In-Memory Data Stores (Users, Sessions, Rooms)
// ============================================================================

const users = new Map(); // id -> user object
const usersByEmail = new Map(); // email.toLowerCase() -> id
const sessions = new Map(); // token -> { userId, expiresAt }
const rooms = new Map(); // code -> room object

// Seed Demo User
const DEMO_USER_ID = "user-demo-01";
const demoUser = {
    id: DEMO_USER_ID,
    name: "Demo Developer",
    email: "demo@cocode.dev",
    passwordHash: hashPassword("password123"),
    createdAt: Date.now(),
};
users.set(DEMO_USER_ID, demoUser);
usersByEmail.set(demoUser.email.toLowerCase(), DEMO_USER_ID);

// Seed a sample active room
rooms.set("DEMO01", {
    code: "DEMO01",
    name: "Public Hackathon Room",
    hostId: DEMO_USER_ID,
    hostName: "Demo Developer",
    isPrivate: false,
    createdAt: Date.now(),
    members: ["Demo Developer"],
});

// Middleware: Require Real Authentication via Bearer Token
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
        return res.status(401).json({
            error: "Authentication required. Please log in to perform this action.",
        });
    }

    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
        if (session) sessions.delete(token);
        return res.status(401).json({
            error: "Session expired or invalid. Please sign in again.",
        });
    }

    const user = users.get(session.userId);
    if (!user) {
        sessions.delete(token);
        return res.status(401).json({
            error: "User account no longer exists.",
        });
    }

    req.user = { id: user.id, name: user.name, email: user.email };
    req.token = token;
    next();
}

app.use(cors());
app.use(express.json({ limit: "64kb" }));

// ============================================================================
// Public Endpoints
// ============================================================================

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to the CoCode API!",
        status: "Server is running",
        endpoints: {
            auth: ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/logout"],
            compiler: ["/api/compiler/run"],
            rooms: ["/api/rooms (protected)", "/api/rooms/join (protected)", "/api/rooms/:code (protected)"],
        },
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        authConnected: true,
        roomsCount: rooms.size,
    });
});

// ============================================================================
// Authentication Routes
// ============================================================================

// Register a new user
app.post("/api/auth/register", (req, res) => {
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

    if (usersByEmail.has(normalizedEmail)) {
        return res.status(409).json({ error: "An account with this email already exists." });
    }

    const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const newUser = {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        createdAt: Date.now(),
    };

    users.set(userId, newUser);
    usersByEmail.set(normalizedEmail, userId);

    // Create session token (expires in 7 days)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    sessions.set(token, { userId, expiresAt });

    return res.status(201).json({
        message: "Account created successfully.",
        token,
        user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
});

// Login
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userId = usersByEmail.get(normalizedEmail);

    if (!userId) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = users.get(userId);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate secure session token (expires in 7 days)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    sessions.set(token, { userId: user.id, expiresAt });

    return res.json({
        message: "Login successful.",
        token,
        user: { id: user.id, name: user.name, email: user.email },
    });
});

// Verify Current User Session
app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({
        user: req.user,
    });
});

// Logout
app.post("/api/auth/logout", requireAuth, (req, res) => {
    sessions.delete(req.token);
    return res.json({ message: "Logged out successfully." });
});

// ============================================================================
// Collaboration Room Routes (Strictly Protected by requireAuth)
// ============================================================================

// Create a collaboration room
app.post("/api/rooms", requireAuth, (req, res) => {
    const { roomName, displayName, isPrivate = false } = req.body || {};

    const cleanName = typeof roomName === "string" ? roomName.trim() : "";
    if (cleanName.length < 3) {
        return res.status(400).json({ error: "Room name must be at least 3 characters." });
    }

    // Generate a unique 6-character room code (e.g. 9X2B7A)
    let code = "";
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // clear without confusing 0/O, 1/I
    for (let attempts = 0; attempts < 10; attempts++) {
        let candidate = "";
        for (let i = 0; i < 6; i++) {
            candidate += chars[crypto.randomInt(0, chars.length)];
        }
        if (!rooms.has(candidate)) {
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

    const newRoom = {
        code,
        name: cleanName,
        hostId: req.user.id,
        hostName: roomHost,
        isPrivate: Boolean(isPrivate),
        createdAt: Date.now(),
        members: [roomHost],
    };

    rooms.set(code, newRoom);

    return res.status(201).json({
        message: "Room created successfully.",
        room: newRoom,
    });
});

// Join an existing room
app.post("/api/rooms/join", requireAuth, (req, res) => {
    const { roomCode, displayName } = req.body || {};

    if (!roomCode || typeof roomCode !== "string") {
        return res.status(400).json({ error: "Please provide a 6-character room code." });
    }

    const normalizedCode = roomCode.trim().toUpperCase();

    if (!rooms.has(normalizedCode)) {
        return res.status(404).json({
            error: `Room "${normalizedCode}" not found or code is invalid. Please check with your host.`,
        });
    }

    const room = rooms.get(normalizedCode);
    const memberName = (displayName && typeof displayName === "string" && displayName.trim())
        ? displayName.trim()
        : req.user.name;

    if (!room.members.includes(memberName)) {
        room.members.push(memberName);
    }

    return res.json({
        message: "Joined room successfully.",
        room: {
            code: room.code,
            name: room.name,
            hostName: room.hostName,
            isPrivate: room.isPrivate,
            createdAt: room.createdAt,
            members: room.members,
        },
    });
});

// Get room details
app.get("/api/rooms/:code", requireAuth, (req, res) => {
    const code = (req.params.code || "").toUpperCase();
    const room = rooms.get(code);

    if (!room) {
        return res.status(404).json({ error: `Room "${code}" not found.` });
    }

    return res.json({ room });
});

// ============================================================================
// Online Compiler Execution Endpoint (Public to guests & authenticated users)
// ============================================================================

function getRetryAfter(ip) {
    const now = Date.now();
    let entry = runRateLimits.get(ip);

    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + 60_000 };
        runRateLimits.set(ip, entry);
    }

    if (entry.count >= 15) {
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

    const languageId = SUPPORTED_LANGUAGES[language];

    if (!languageId) {
        return res.status(400).json({
            error: "Unsupported language. Choose Python, JavaScript, or C++.",
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

        return res.json({
            status: result.status?.description || "Finished",
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            compileOutput: result.compile_output || "",
            message: result.message || "",
            time: result.time ?? null,
            memory: result.memory ?? null,
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
            error:
                "Cannot reach the execution service. Check network connection.",
        });
    }
});

app.listen(PORT, () => {
    console.log(`CoCode server running at http://localhost:${PORT}`);
    console.log(`Demo user available: demo@cocode.dev / password123`);
});
