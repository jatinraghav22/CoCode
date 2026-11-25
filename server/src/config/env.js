/**
 * env.js — Environment Configuration & Startup Validation
 *
 * This module reads all required environment variables and validates them.
 * In production, it will crash the server immediately on startup if any
 * critical variable is missing or insecure — this is intentional and safe.
 *
 * "Fail fast" is a security principle: it's better to refuse to start than
 * to run silently with a broken or insecure configuration.
 */

"use strict";

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// ─── Helper: validate a secret has minimum entropy ────────────────────────────
function assertSecret(value, name, minLength = 32) {
    if (!value || typeof value !== "string" || value.trim().length < minLength) {
        const msg = `[STARTUP] FATAL: Environment variable "${name}" is missing or too short (minimum ${minLength} characters). Set it in your .env file.`;
        console.error(msg);
        if (isProduction) {
            process.exit(1); // Hard stop in production
        }
        // In development, warn but continue so local dev is not blocked
        console.warn(`[STARTUP] WARNING: Running in development mode with an insecure ${name}. Never deploy this to production.`);
    }
}

// ─── Validate critical secrets ────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
assertSecret(JWT_SECRET, "JWT_SECRET", 32);

// Database URL fallback for various cloud MySQL providers
const resolvedDatabaseUrl =
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    process.env.JAWSDB_URL ||
    process.env.CLEARDB_DATABASE_URL;

if (resolvedDatabaseUrl && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = resolvedDatabaseUrl;
}

if (!resolvedDatabaseUrl) {
    console.error("[STARTUP] FATAL: DATABASE_URL is not set. Please set DATABASE_URL in your deployment environment.");
    if (isProduction) process.exit(1);
}

// ─── Export validated, normalised config ─────────────────────────────────────
const config = {
    // Server
    NODE_ENV,
    isProduction,
    PORT: parseInt(process.env.PORT, 10) || 5000,

    // Database
    DATABASE_URL: resolvedDatabaseUrl,

    // JWT — issuer and audience add an extra layer of token validation.
    // A token signed by CoCode's server but intended for a different service
    // will be rejected even if the signature is valid.
    JWT_SECRET: JWT_SECRET || "cocode_local_dev_secret_DO_NOT_USE_IN_PRODUCTION_12345678",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
    JWT_ISSUER: process.env.JWT_ISSUER || "cocode-api",
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || "cocode-client",

    // CORS — restrict to known frontend origins
    CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173,https://getcocode.vercel.app,https://www.getcocode.app,https://getcocode.app",

    // Judge0 Compiler
    JUDGE0_BASE_URL: (process.env.JUDGE0_BASE_URL || "https://ce.judge0.com").replace(/\/+$/, ""),
    JUDGE0_AUTH_TOKEN: process.env.JUDGE0_AUTH_TOKEN || null,

    // AI Assistant (optional)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || null,
};

module.exports = config;
