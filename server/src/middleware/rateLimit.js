/**
 * rateLimit.js — Express Rate Limiting Middleware
 *
 * Protects authentication endpoints from brute-force attacks.
 *
 * HOW IT WORKS:
 * express-rate-limit counts requests per IP address. If an IP exceeds
 * the limit within the time window, all subsequent requests get a 429
 * "Too Many Requests" response until the window resets.
 *
 * LIMITS (deliberately lenient for development):
 * - Login:      20 attempts per 15 minutes per IP
 * - Register:   10 attempts per 60 minutes per IP
 * - Compiler:   25 attempts per 60 seconds per IP (existing behaviour)
 * - General:    300 requests per minute per IP (overall API protection)
 *
 * These limits are intentionally not too strict so normal dev workflows
 * (curl testing, Postman, page refreshes) are not blocked.
 */

"use strict";

const rateLimit = require("express-rate-limit");

// ─── Standard rate limit error response formatter ────────────────────────────
function rateLimitHandler(req, res) {
    return res.status(429).json({
        error: "Too many requests from this address. Please wait and try again.",
    });
}

/**
 * authLoginLimiter — Protects POST /api/auth/login
 *
 * 20 login attempts per 15 minutes is generous enough for a real user
 * who forgot their password, but stops automated brute-force attacks cold.
 */
const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: () => process.env.NODE_ENV === "test", // Don't rate-limit automated tests
});

/**
 * authRegisterLimiter — Protects POST /api/auth/register
 *
 * 10 registrations per hour prevents automated account creation spam.
 */
const authRegisterLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: () => process.env.NODE_ENV === "test",
});

/**
 * compilerLimiter — Protects POST /api/compiler/run
 *
 * 25 code runs per minute. Matches existing in-memory Map behaviour
 * but now works correctly across server restarts.
 */
const compilerLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const retryAfter = res.getHeader("Retry-After") || 60;
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({
            error: "Too many execution requests. Please wait before running more code.",
        });
    },
});

/**
 * generalApiLimiter — Light protection across all API routes
 *
 * 300 requests per minute is very generous — a normal user hitting
 * refresh repeatedly would not trigger this.
 */
const generalApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
});

module.exports = {
    authLoginLimiter,
    authRegisterLimiter,
    compilerLimiter,
    generalApiLimiter,
};
