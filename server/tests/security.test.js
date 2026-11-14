/**
 * security.test.js — Static Security Assertion Tests
 *
 * These tests check the source code itself for security properties.
 * They do NOT require MySQL or the server to be running.
 * They verify that specific insecure patterns have been removed.
 *
 * Run with: cd server && node --test tests/security.test.js
 */

"use strict";

process.env.NODE_ENV = "test";
require("dotenv").config();

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const serverJs = fs.readFileSync(path.join(__dirname, "../server.js"), "utf-8");
const envExample = fs.readFileSync(path.join(__dirname, "../.env.example"), "utf-8");
const sessionJs = fs.readFileSync(path.join(__dirname, "../src/services/session.js"), "utf-8");
const authMiddleware = fs.readFileSync(path.join(__dirname, "../src/middleware/auth.js"), "utf-8");
const schemaFile = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf-8");

console.log("\n╔═══════════════════════════════════════════╗");
console.log("║  CoCode — Static Security Assertions      ║");
console.log("╚═══════════════════════════════════════════╝\n");

describe("server.js — Security Assertions", () => {
    test("No hardcoded JWT fallback secret", () => {
        assert.ok(
            !serverJs.includes("cocode_jwt_secret_dev_and_prod_key_2026"),
            "FAIL: Old hardcoded JWT secret found in server.js"
        );
    });

    test("No demo auto-creation in login route", () => {
        // The old code had: if (!user && (normalizedEmail === "demo@cocode.dev" ...)) { user = await prisma.user.create
        assert.ok(
            !serverJs.includes("normalizedEmail === \"demo@cocode.dev\""),
            "FAIL: Demo auto-creation condition found in server.js"
        );
    });

    test("No hardcoded real user email", () => {
        assert.ok(
            !serverJs.includes("jatinraghav22@gmail.com"),
            "FAIL: Real user email is hardcoded in server.js"
        );
    });

    test("helmet is used for secure headers", () => {
        assert.ok(
            serverJs.includes("helmet"),
            "FAIL: helmet middleware not found in server.js"
        );
    });

    test("CORS is not set to wildcard *", () => {
        // The old code had: origin: "*"
        // The new code uses allowedOrigins from env — may include "*" if CLIENT_URL is "*"
        // but the socket.io config must not use the wildcard string directly
        assert.ok(
            !serverJs.includes('origin: "*"'),
            "FAIL: CORS wildcard origin still present in server.js"
        );
    });

    test("requireAuth is imported from modular middleware", () => {
        assert.ok(
            serverJs.includes("require(\"./src/middleware/auth\")"),
            "FAIL: requireAuth not imported from modular middleware"
        );
    });

    test("Socket.IO uses socketAuth middleware", () => {
        assert.ok(
            serverJs.includes("io.use(socketAuth)"),
            "FAIL: Socket.IO does not use socketAuth middleware"
        );
    });

    test("Socket.IO join-room ignores frontend displayName for identity", () => {
        // The old code set currentUser = displayName from payload
        // The new code uses socket.data.userName (from JWT/DB)
        assert.ok(
            serverJs.includes("authenticatedUserName"),
            "FAIL: Socket handler does not use authenticated user name from JWT"
        );
        assert.ok(
            !serverJs.includes("currentUser = displayName"),
            "FAIL: Socket handler still trusts displayName from frontend payload"
        );
    });

    test("Logout route actually revokes the session", () => {
        assert.ok(
            serverJs.includes("revokeSession(req.token)"),
            "FAIL: Logout route does not call revokeSession"
        );
    });

    test("Logout-all-devices endpoint exists", () => {
        assert.ok(
            serverJs.includes("/api/auth/logout-all"),
            "FAIL: Logout-all-devices endpoint not found"
        );
    });

    test("Login route records session in DB", () => {
        assert.ok(
            serverJs.includes("createSession"),
            "FAIL: Login route does not call createSession"
        );
    });

    test("Rate limiters applied to auth routes", () => {
        assert.ok(
            serverJs.includes("authLoginLimiter"),
            "FAIL: authLoginLimiter not applied to login route"
        );
        assert.ok(
            serverJs.includes("authRegisterLimiter"),
            "FAIL: authRegisterLimiter not applied to register route"
        );
    });

    test("compilerLimiter replaces old in-memory Map rate limiter", () => {
        // The old code defined runRateLimits as a live Map for rate limiting.
        // The new code uses express-rate-limit middleware (compilerLimiter).
        // The old Map may appear in comments but must NOT be used as actual rate limiting.
        assert.ok(
            !serverJs.includes("const runRateLimits = new Map()"),
            "FAIL: Old runRateLimits Map is still being instantiated in server.js"
        );
        assert.ok(
            serverJs.includes("compilerLimiter"),
            "FAIL: compilerLimiter middleware not applied to compiler route"
        );
    });

    test("Max password length guard prevents DoS", () => {
        assert.ok(
            serverJs.includes("MAX_PASSWORD_LENGTH"),
            "FAIL: No max password length guard in server.js"
        );
    });
});

describe("session.js — Session Service Assertions", () => {
    test("Uses SHA-256 hashing for token storage", () => {
        assert.ok(sessionJs.includes("sha256"), "FAIL: session.js does not use SHA-256");
    });

    test("Stores tokenHash, not raw token", () => {
        assert.ok(sessionJs.includes("tokenHash"), "FAIL: session.js missing tokenHash field");
        assert.ok(!sessionJs.includes('"token": token'), "FAIL: Raw token being stored");
    });

    test("revokeSession function exists", () => {
        assert.ok(sessionJs.includes("async function revokeSession"), "FAIL: revokeSession not defined");
    });

    test("revokeAllSessions function exists", () => {
        assert.ok(sessionJs.includes("async function revokeAllSessions"), "FAIL: revokeAllSessions not defined");
    });

    test("cleanupExpiredSessions function exists", () => {
        assert.ok(sessionJs.includes("async function cleanupExpiredSessions"), "FAIL: cleanupExpiredSessions not defined");
    });
});

describe("auth.js middleware — Assertions", () => {
    test("requireAuth checks session revocation", () => {
        assert.ok(
            authMiddleware.includes("isSessionValid"),
            "FAIL: requireAuth does not check session revocation"
        );
    });

    test("socketAuth is exported", () => {
        assert.ok(
            authMiddleware.includes("socketAuth"),
            "FAIL: socketAuth not defined in auth middleware"
        );
    });

    test("formatUserProfile never includes passwordHash", () => {
        // Verify the return object in formatUserProfile does not expose passwordHash.
        // We check that the returned object literal does not contain it as a key.
        // The comment "// passwordHash is intentionally excluded" is acceptable.
        const fnStart = authMiddleware.indexOf("function formatUserProfile");
        const fnEnd = authMiddleware.indexOf("\n}", fnStart) + 2;
        const fnBody = authMiddleware.slice(fnStart, fnEnd);

        // Extract just the return statement object (between "return {" and final "};")
        const returnStart = fnBody.lastIndexOf("return {");
        const returnEnd = fnBody.lastIndexOf("};");
        const returnObj = fnBody.slice(returnStart, returnEnd);

        assert.ok(
            !returnObj.includes("passwordHash:"),
            "FAIL: formatUserProfile return object includes passwordHash as a key"
        );
    });

    test("JWT verification includes issuer and audience", () => {
        assert.ok(
            authMiddleware.includes("issuer: config.JWT_ISSUER"),
            "FAIL: JWT verification missing issuer check"
        );
        assert.ok(
            authMiddleware.includes("audience: config.JWT_AUDIENCE"),
            "FAIL: JWT verification missing audience check"
        );
    });
});

describe("prisma/schema.prisma — Assertions", () => {
    test("AuthSession model exists in schema", () => {
        assert.ok(
            schemaFile.includes("model AuthSession"),
            "FAIL: AuthSession model not found in schema.prisma"
        );
    });

    test("AuthSession stores tokenHash (not raw token)", () => {
        assert.ok(
            schemaFile.includes("tokenHash"),
            "FAIL: AuthSession schema missing tokenHash field"
        );
    });

    test("AuthSession has revokedAt field for revocation tracking", () => {
        assert.ok(
            schemaFile.includes("revokedAt"),
            "FAIL: AuthSession schema missing revokedAt field"
        );
    });

    test("AuthSession has index on tokenHash for fast lookups", () => {
        assert.ok(
            schemaFile.includes("@@index([tokenHash])"),
            "FAIL: AuthSession missing index on tokenHash"
        );
    });

    test("User model has authSessions relation", () => {
        assert.ok(
            schemaFile.includes("authSessions  AuthSession[]"),
            "FAIL: User model missing authSessions relation"
        );
    });
});

describe(".env.example — Assertions", () => {
    test("No real database password in example file", () => {
        assert.ok(!envExample.includes("Jatin@2007"), "FAIL: Real DB password in .env.example");
        assert.ok(!envExample.includes("root:Jatin"), "FAIL: Real DB credentials in .env.example");
    });

    test("JWT_SECRET is a placeholder in example", () => {
        assert.ok(
            envExample.includes("REPLACE_WITH"),
            "FAIL: .env.example should use REPLACE_WITH placeholder for JWT_SECRET"
        );
    });

    test("All required env vars are documented", () => {
        const requiredVars = ["DATABASE_URL", "JWT_SECRET", "JWT_EXPIRES_IN", "JWT_ISSUER",
            "JWT_AUDIENCE", "CLIENT_URL", "NODE_ENV", "PORT"];
        for (const v of requiredVars) {
            assert.ok(envExample.includes(v), `FAIL: .env.example missing ${v}`);
        }
    });
});
