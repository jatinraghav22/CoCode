/**
 * auth.js — Authentication Middleware
 *
 * Provides two middleware functions:
 *
 *   requireAuth  — Rejects unauthenticated requests with 401.
 *                  Also checks MySQL session revocation table.
 *                  Use on all routes that need a logged-in user.
 *
 *   optionalAuth — Silently sets req.user if a valid token is present.
 *                  Returns null user if no token or invalid token.
 *                  Use on routes accessible to both guests and users (e.g. compiler).
 *
 * Token validation order:
 *   1. Extract Bearer token from Authorization header
 *   2. Verify JWT signature + expiry + issuer + audience
 *   3. Look up user in MySQL (confirms account still exists)
 *   4. Check AuthSession table (confirms session was not revoked)
 *   5. Attach req.user, req.userId, req.token to request object
 */

"use strict";

const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { isSessionValid } = require("../services/session");
const config = require("../config/env");

// ─── Helper: format user profile for API responses ───────────────────────────
// Strips sensitive fields (passwordHash, etc.) and normalises data types.
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
        // Note: passwordHash and other sensitive fields are intentionally not returned
    };
}

/**
 * Extract and verify a JWT from the Authorization header.
 * Returns { decoded, token } on success, or null on failure.
 * Never throws — all errors return null.
 */
function extractToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7).trim();
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET, {
            issuer: config.JWT_ISSUER,
            audience: config.JWT_AUDIENCE,
        });
        return { decoded, token };
    } catch {
        return null;
    }
}

/**
 * requireAuth — Middleware that enforces authentication.
 *
 * On success: populates req.user, req.rawUser, req.userId, req.token
 * On failure: responds with 401 JSON error
 */
async function requireAuth(req, res, next) {
    const extracted = extractToken(req);

    if (!extracted) {
        return res.status(401).json({
            error: "Authentication required. Please log in to perform this action.",
        });
    }

    const { decoded, token } = extracted;

    try {
        // 1. Confirm the user account still exists in MySQL
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            return res.status(401).json({
                error: "User account no longer exists.",
            });
        }

        // 2. Check session revocation table.
        //    isSessionValid returns true for tokens issued before the AuthSession
        //    table existed (backward compatibility). Once a user logs in again after
        //    this update, their new token WILL be tracked and can be revoked.
        const sessionValid = await isSessionValid(token);

        // If the session record exists AND is revoked, reject immediately.
        // If the record does not exist (pre-migration token), we allow it through
        // so existing logged-in users are not suddenly logged out.
        if (sessionValid === false) {
            // isSessionValid returns false for: revoked sessions
            // Check if the record actually exists (vs just not tracked yet)
            const { hashToken } = require("../services/session");
            const { PrismaClient: _ } = require("@prisma/client"); // avoid circular
            const record = await prisma.authSession.findUnique({
                where: { tokenHash: hashToken(token) },
            }).catch(() => null);

            if (record && record.revokedAt !== null) {
                return res.status(401).json({
                    error: "Session has been revoked. Please sign in again.",
                    code: "SESSION_REVOKED",
                });
            }
            // No record = old token from before session tracking; allow it through
        }

        req.user = formatUserProfile(user);
        req.rawUser = user;
        req.userId = user.id;
        req.token = token;

        next();
    } catch (err) {
        console.error("[auth] requireAuth error:", err.message);
        return res.status(401).json({
            error: "Session expired or invalid. Please sign in again.",
        });
    }
}

/**
 * optionalAuth — Silently loads the authenticated user if a valid token is present.
 * Does NOT reject the request if no token is provided.
 * Use on public routes that have optional user-specific behaviour.
 */
async function optionalAuth(req, res, next) {
    const extracted = extractToken(req);

    if (!extracted) {
        req.user = null;
        req.userId = null;
        req.token = null;
        return next();
    }

    const { decoded, token } = extracted;

    try {
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            req.user = null;
            req.userId = null;
            req.token = null;
            return next();
        }

        req.user = formatUserProfile(user);
        req.rawUser = user;
        req.userId = user.id;
        req.token = token;
    } catch {
        req.user = null;
        req.userId = null;
        req.token = null;
    }

    next();
}

/**
 * socketAuth — Verifies a JWT for Socket.IO connections.
 * Used in the Socket.IO middleware (io.use(...)).
 *
 * On success: populates socket.data.user and socket.data.userId
 * On failure: calls next(new Error(...)) which disconnects the socket
 */
async function socketAuth(socket, next) {
    // Socket.IO sends auth data via socket.handshake.auth (set by client as { token })
    const token = socket.handshake.auth?.token;

    if (!token || typeof token !== "string") {
        return next(new Error("Authentication required. Please sign in to join rooms."));
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.JWT_SECRET, {
            issuer: config.JWT_ISSUER,
            audience: config.JWT_AUDIENCE,
        });
    } catch {
        return next(new Error("Invalid or expired session token. Please sign in again."));
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            return next(new Error("User account not found. Please sign in again."));
        }

        // Check revocation for socket connections too
        const { hashToken } = require("../services/session");
        const record = await prisma.authSession.findUnique({
            where: { tokenHash: hashToken(token) },
        }).catch(() => null);

        if (record && record.revokedAt !== null) {
            return next(new Error("Session has been revoked. Please sign in again."));
        }

        // Attach authenticated user data to socket — frontend cannot override this
        socket.data.userId = user.id;
        socket.data.userName = user.name; // Always use DB name, never frontend payload
        socket.data.userEmail = user.email;
        socket.data.token = token;

        next();
    } catch (err) {
        console.error("[socketAuth] Error verifying socket user:", err.message);
        next(new Error("Authentication error. Please reconnect."));
    }
}

module.exports = { requireAuth, optionalAuth, socketAuth, formatUserProfile };
