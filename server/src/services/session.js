/**
 * session.js — Auth Session Management Service
 *
 * This service handles database-backed JWT session tracking.
 *
 * WHY: JWTs are stateless by design — once issued, they're valid until expiry.
 * That means a stolen token or a logged-out user's token stays valid for the
 * full 7-day window. We solve this by tracking every live session in MySQL.
 * On logout, we "revoke" the session. requireAuth checks the DB every request.
 *
 * SECURITY NOTES:
 * - We store a SHA-256 HASH of the token, never the token itself.
 * - If the sessions table were leaked, raw tokens would still be safe.
 * - We clean up expired sessions periodically to keep the table small.
 */

"use strict";

const crypto = require("crypto");
const prisma = require("../config/prisma");

/**
 * Hash a JWT token for safe database storage.
 * SHA-256 is fast enough for this lookup and prevents raw token leakage.
 *
 * @param {string} token - The raw JWT string
 * @returns {string} 64-character hex SHA-256 hash
 */
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new auth session record when a user logs in.
 *
 * @param {object} opts
 * @param {string} opts.userId      - The authenticated user's database ID
 * @param {string} opts.token       - The raw JWT (will be hashed before storage)
 * @param {Date}   opts.expiresAt   - When the JWT expires (from the exp claim)
 * @param {string} [opts.ipAddress] - Client IP address (optional, for audit)
 * @param {string} [opts.userAgent] - Client user-agent (optional, for audit)
 * @returns {Promise<object>} The created AuthSession record
 */
async function createSession({ userId, token, expiresAt, ipAddress, userAgent }) {
    const tokenHash = hashToken(token);

    return prisma.authSession.create({
        data: {
            userId,
            tokenHash,
            expiresAt,
            ipAddress: ipAddress ? String(ipAddress).slice(0, 45) : null,
            userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        },
    });
}

/**
 * Verify that a token's session exists and has not been revoked.
 *
 * @param {string} token - The raw JWT from the Authorization header
 * @returns {Promise<boolean>} true if the session is valid and active
 */
async function isSessionValid(token) {
    const tokenHash = hashToken(token);

    const session = await prisma.authSession.findUnique({
        where: { tokenHash },
    });

    if (!session) return false;             // Session was never created (old token from before this feature)
    if (session.revokedAt !== null) return false; // Session was revoked (logout)
    if (session.expiresAt < new Date()) return false; // Session expired in DB

    return true;
}

/**
 * Revoke the current session (logout from this device).
 *
 * @param {string} token - The raw JWT to revoke
 * @returns {Promise<void>}
 */
async function revokeSession(token) {
    const tokenHash = hashToken(token);

    await prisma.authSession.updateMany({
        where: {
            tokenHash,
            revokedAt: null, // Only update if not already revoked
        },
        data: {
            revokedAt: new Date(),
        },
    }).catch(() => {
        // If the session doesn't exist, that's fine — treat it as already revoked
    });
}

/**
 * Revoke ALL active sessions for a user (logout from all devices).
 *
 * @param {string} userId - The user's database ID
 * @returns {Promise<number>} Number of sessions revoked
 */
async function revokeAllSessions(userId) {
    const result = await prisma.authSession.updateMany({
        where: {
            userId,
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        },
    });

    return result.count;
}

/**
 * Delete expired and revoked session records to keep the table small.
 * Safe to run periodically (e.g., on startup or via a cron-style interval).
 * This NEVER deletes active sessions.
 *
 * @returns {Promise<number>} Number of records deleted
 */
async function cleanupExpiredSessions() {
    const cutoff = new Date();

    const result = await prisma.authSession.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: cutoff } },      // JWT has naturally expired
                {
                    revokedAt: { not: null },         // Was manually revoked AND
                    revokedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // older than 1 day
                },
            ],
        },
    }).catch(() => ({ count: 0 }));

    return result.count;
}

module.exports = {
    hashToken,
    createSession,
    isSessionValid,
    revokeSession,
    revokeAllSessions,
    cleanupExpiredSessions,
};
