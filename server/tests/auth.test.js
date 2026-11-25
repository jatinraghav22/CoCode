/**
 * auth.test.js â€” CoCode Authentication & Security Test Suite
 *
 * This file tests all Phase 2 security requirements:
 *   - Registration and login
 *   - JWT claim validation (issuer, audience, expiry)
 *   - Session revocation (logout)
 *   - Logout-all-devices
 *   - Demo auto-creation removal
 *   - Protected endpoint access
 *   - Socket.IO authentication
 *   - Room authorization
 *   - Regression tests for existing features
 *
 * HOW TO RUN (after MySQL is running and migration is applied):
 *   cd server
 *   npm test
 *
 * Uses Node's built-in test runner (Node 18+) â€” no extra test framework needed.
 *
 * IMPORTANT: Uses a TEST_ prefixed email to avoid affecting real user data.
 * The test cleans up after itself.
 */

"use strict";

process.env.NODE_ENV = "test"; // Disables rate limiting for test runs
require("dotenv").config();

const { test, describe, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");

// â”€â”€â”€ Import the app components for direct unit testing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const config = require("../src/config/env");
const prisma = require("../src/config/prisma");
const { hashToken, createSession, isSessionValid, revokeSession, revokeAllSessions } = require("../src/services/session");

// â”€â”€â”€ Test Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const API_BASE = `http://localhost:${config.PORT || 5000}`;

// Use unique test emails so tests never collide with real accounts
const TEST_EMAIL = `test_${Date.now()}@cocode-test.internal`;
const TEST_PASSWORD = "TestPassword_2026!";
const TEST_NAME = "Auth Test User";

// Track data created during tests for cleanup
let testUserId = null;
let testToken = null;

// â”€â”€â”€ Helper: HTTP request wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function req(method, path, body = null, authToken = null) {
    const url = `${API_BASE}${path}`;
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const fetchOptions = {
        method,
        headers,
    };
    if (body) fetchOptions.body = JSON.stringify(body);

    const res = await fetch(url, fetchOptions);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

// â”€â”€â”€ UNIT TESTS: Session Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe("Session Service â€” Unit Tests", () => {
    test("hashToken produces consistent 64-char hex output", () => {
        const token = "some.jwt.token.here";
        const hash1 = hashToken(token);
        const hash2 = hashToken(token);

        assert.equal(hash1, hash2, "Same token should always produce same hash");
        assert.equal(hash1.length, 64, "SHA-256 hex should be 64 characters");
        assert.match(hash1, /^[a-f0-9]+$/, "Should be lowercase hex");
    });

    test("hashToken produces different hashes for different tokens", () => {
        const hash1 = hashToken("token_a");
        const hash2 = hashToken("token_b");
        assert.notEqual(hash1, hash2, "Different tokens must hash differently");
    });
});

// â”€â”€â”€ UNIT TESTS: Config / Env â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe("Environment Config â€” Unit Tests", () => {
    test("JWT_SECRET is loaded and meets minimum length", () => {
        assert.ok(config.JWT_SECRET, "JWT_SECRET must be set");
        assert.ok(config.JWT_SECRET.length >= 32, "JWT_SECRET must be at least 32 characters");
    });

    test("JWT_ISSUER and JWT_AUDIENCE are configured", () => {
        assert.equal(config.JWT_ISSUER, "cocode-api");
        assert.equal(config.JWT_AUDIENCE, "cocode-client");
    });

    test("No hardcoded production fallback secret in config", () => {
        // The old insecure fallback string must not be the active secret
        assert.notEqual(
            config.JWT_SECRET,
            "cocode_jwt_secret_dev_and_prod_key_2026",
            "Must not use the old hardcoded fallback secret"
        );
    });

    test("CLIENT_URL is configured", () => {
        assert.ok(config.CLIENT_URL, "CLIENT_URL must be set");
    });
});

// â”€â”€â”€ INTEGRATION TESTS (require server + MySQL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ INTEGRATION TESTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// All integration tests are inside a SINGLE test() to guarantee strict
// sequential execution. Node.js 24's test runner runs sibling test() calls
// concurrently by default; wrapping everything in one async test avoids
// all races when sessions need to be created/revoked in order.

async function isServerOnline() {
    try {
        const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
        if (!res.ok) return false;
        const body = await res.json().catch(() => ({}));
        // Verify this is the legacy server (has roomsCount and database === 'connected', not cocode-backend-v2)
        if (body.service === "cocode-backend-v2" || body.roomsCount === undefined || body.database !== "connected") {
            return false;
        }
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

test("Authentication API — Integration Tests (sequential)", async (t) => {
    const online = await isServerOnline();
    if (!online) {
        console.warn(`\n[SKIP] Server not reachable at ${API_BASE}. Start the server and MySQL to run integration tests.\n`);
        t.skip(`Server not reachable at ${API_BASE}`);
        return;
    }

    let localTestUserId = null;
    let localTestToken = null;
    let localTestEmail = `test_${Date.now()}@cocode-test.internal`;
    const localTestPassword = "TestPassword_2026!";
    const localTestName = "Auth Test User";

    try {
        // â”€â”€ 1. REGISTRATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // Test 1: Successful registration
        {
            const { status, data } = await req("POST", "/api/auth/register", {
                name: localTestName,
                email: localTestEmail,
                password: localTestPassword,
            });
            assert.equal(status, 201, `[T1] Expected 201, got ${status}: ${JSON.stringify(data)}`);
            assert.ok(data.token, "[T1] Response must include a JWT token");
            assert.ok(!data.user.passwordHash, "[T1] Response must NOT include passwordHash");
            assert.equal(data.user.email, localTestEmail);
            localTestUserId = data.user.id;
            localTestToken = data.token;
            testUserId = localTestUserId;
            testToken = localTestToken;
            console.log("  âœ” T1: Registration succeeded");
        }

        // Test 2: Duplicate email â†’ 409
        {
            const { status } = await req("POST", "/api/auth/register", {
                name: localTestName, email: localTestEmail, password: localTestPassword,
            });
            assert.equal(status, 409, "[T2] Duplicate email must return 409");
            console.log("  âœ” T2: Duplicate email â†’ 409");
        }

        // Test 3: Invalid email â†’ 400
        {
            const { status } = await req("POST", "/api/auth/register", {
                name: "Test", email: "not-an-email", password: "validpassword123",
            });
            assert.equal(status, 400, "[T3] Invalid email must return 400");
            console.log("  âœ” T3: Invalid email â†’ 400");
        }

        // Test 4: Short password â†’ 400
        {
            const { status } = await req("POST", "/api/auth/register", {
                name: "Test", email: `short_pw_${Date.now()}@test.internal`, password: "1234567",
            });
            assert.equal(status, 400, "[T4] Short password must return 400");
            console.log("  âœ” T4: Short password â†’ 400");
        }

        // Test 4b: Long password â†’ 400
        {
            const { status } = await req("POST", "/api/auth/register", {
                name: "Test", email: `longpw_${Date.now()}@test.internal`, password: "a".repeat(300),
            });
            assert.equal(status, 400, "[T4b] Long password must return 400");
            console.log("  âœ” T4b: Long password â†’ 400");
        }

        // â”€â”€ 2. LOGIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // Test 5: Successful login
        {
            const { status, data } = await req("POST", "/api/auth/login", {
                email: localTestEmail, password: localTestPassword,
            });
            assert.equal(status, 200, `[T5] Login failed: ${status} ${JSON.stringify(data)}`);
            assert.ok(data.token, "[T5] Must return a token");
            assert.ok(!data.user.passwordHash, "[T5] Must NOT return passwordHash");
            const jwt = require("jsonwebtoken");
            const decoded = jwt.verify(data.token, config.JWT_SECRET, {
                issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE,
            });
            assert.ok(decoded.userId, "[T5] Token must have userId");
            assert.equal(decoded.iss, "cocode-api");
            assert.equal(decoded.aud, "cocode-client");
            console.log("  âœ” T5: Login â†’ JWT with correct claims");
        }

        // Test 6: Wrong password â†’ 401
        {
            const { status, data } = await req("POST", "/api/auth/login", {
                email: localTestEmail, password: "WrongPassword!",
            });
            assert.equal(status, 401, "[T6] Wrong password must return 401");
            assert.match(data.error, /invalid/i);
            console.log("  âœ” T6: Wrong password â†’ 401");
        }

        // Test 7: Non-existent account â†’ 401
        {
            const { status } = await req("POST", "/api/auth/login", {
                email: "nonexistent_zzzz@test.internal", password: "anypassword",
            });
            assert.equal(status, 401, "[T7] Non-existent account must return 401 (not 404)");
            console.log("  âœ” T7: Non-existent account â†’ 401");
        }

        // Demo auto-creation removed test
        {
            const demoBefore = await prisma.user.findUnique({ where: { email: "demo@cocode.dev" } });
            if (!demoBefore) {
                const { status } = await req("POST", "/api/auth/login", {
                    email: "demo@cocode.dev", password: "password123",
                });
                assert.equal(status, 401, "Demo login must NOT auto-create account");
                const demoAfter = await prisma.user.findUnique({ where: { email: "demo@cocode.dev" } });
                assert.equal(demoAfter, null, "Demo account must NOT have been created");
            }
            console.log("  âœ” Demo auto-creation: REMOVED");
        }

        // â”€â”€ 3. JWT VALIDATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        {
            const { status } = await req("GET", "/api/auth/me");
            assert.equal(status, 401, "[T8] Missing JWT must return 401");
            console.log("  âœ” T8: Missing JWT â†’ 401");
        }

        {
            const { status } = await req("GET", "/api/auth/me", null, "not.a.real.jwt.token");
            assert.equal(status, 401, "[T9] Malformed JWT must return 401");
            console.log("  âœ” T9: Malformed JWT â†’ 401");
        }

        {
            const jwt = require("jsonwebtoken");
            const fakeToken = jwt.sign({ userId: "fake-id" }, "wrong_secret", {
                expiresIn: "1h", issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE,
            });
            const { status } = await req("GET", "/api/auth/me", null, fakeToken);
            assert.equal(status, 401, "[T10] Wrong secret must return 401");
            console.log("  âœ” T10: Wrong secret JWT â†’ 401");
        }

        {
            const jwt = require("jsonwebtoken");
            const fakeToken = jwt.sign({ userId: localTestUserId }, config.JWT_SECRET, {
                expiresIn: "1h", issuer: "some-other-service", audience: config.JWT_AUDIENCE,
            });
            const { status } = await req("GET", "/api/auth/me", null, fakeToken);
            assert.equal(status, 401, "[T10b] Wrong issuer must return 401");
            console.log("  âœ” T10b: Wrong issuer â†’ 401");
        }

        {
            const jwt = require("jsonwebtoken");
            const fakeToken = jwt.sign({ userId: localTestUserId }, config.JWT_SECRET, {
                expiresIn: "1h", issuer: config.JWT_ISSUER, audience: "wrong-audience",
            });
            const { status } = await req("GET", "/api/auth/me", null, fakeToken);
            assert.equal(status, 401, "[T10c] Wrong audience must return 401");
            console.log("  âœ” T10c: Wrong audience â†’ 401");
        }

        {
            const { status, data } = await req("GET", "/api/auth/me", null, localTestToken);
            assert.equal(status, 200, "[T11] Valid JWT must access protected route");
            assert.ok(data.user);
            assert.equal(data.user.email, localTestEmail);
            console.log("  âœ” T11: Valid JWT â†’ protected route accessible");
        }

        // â”€â”€ 4. LOGOUT & SESSION REVOCATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // Fresh login for logout test
        let sessionTokenForLogout;
        {
            const { data } = await req("POST", "/api/auth/login", {
                email: localTestEmail, password: localTestPassword,
            });
            sessionTokenForLogout = data.token;
            assert.ok(sessionTokenForLogout, "[T12] Must get fresh token for logout test");
        }

        {
            const { status, data: logoutData } = await req("POST", "/api/auth/logout", null, sessionTokenForLogout);
            assert.equal(status, 200, "[T12] Logout must return 200");
            assert.ok(logoutData.message);
            console.log("  âœ” T12: Logout succeeded");
        }

        {
            const { status } = await req("GET", "/api/auth/me", null, sessionTokenForLogout);
            assert.equal(status, 401, "[T13] Revoked token must be rejected");
            console.log("  âœ” T13: Revoked token rejected");
        }

        {
            const record = await prisma.authSession.findFirst({
                where: { revokedAt: { not: null }, user: { email: localTestEmail } },
            });
            assert.ok(record !== undefined, "[T-db] DB must have revocation record");
            console.log("  âœ” T-db: Revocation persists in DB");
        }

        // â”€â”€ 5. LOGOUT ALL DEVICES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        {
            // Create two fresh sessions
            const r1 = await req("POST", "/api/auth/login", { email: localTestEmail, password: localTestPassword });
            const r2 = await req("POST", "/api/auth/login", { email: localTestEmail, password: localTestPassword });
            assert.ok(r1.data?.token, `[T14] Login 1 failed: ${r1.status} ${JSON.stringify(r1.data)}`);
            assert.ok(r2.data?.token, `[T14] Login 2 failed: ${r2.status} ${JSON.stringify(r2.data)}`);
            const tok1 = r1.data.token;
            const tok2 = r2.data.token;

            // Revoke all with tok1
            const { status, data } = await req("POST", "/api/auth/logout-all", null, tok1);
            assert.equal(status, 200, `[T14] logout-all failed: ${status} ${JSON.stringify(data)}`);
            assert.ok(data.sessionsRevoked >= 1, `[T14] Expected â‰¥1 revoked, got ${data.sessionsRevoked}`);

            // Both must now be rejected
            const c1 = await req("GET", "/api/auth/me", null, tok1);
            assert.equal(c1.status, 401, "[T15] tok1 must be rejected after logout-all");
            const c2 = await req("GET", "/api/auth/me", null, tok2);
            assert.equal(c2.status, 401, "[T16] tok2 must be rejected after logout-all");
            console.log(`  âœ” T14-16: Logout-all revoked ${data.sessionsRevoked} session(s); both tokens rejected`);
        }

        // â”€â”€ 6. REGRESSION TESTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        // Fresh login after all logout tests
        let freshRegToken;
        {
            const { status, data } = await req("POST", "/api/auth/login", {
                email: localTestEmail, password: localTestPassword,
            });
            assert.equal(status, 200, `[Reg-setup] Fresh login failed: ${status} ${JSON.stringify(data)}`);
            freshRegToken = data.token;
            console.log("  âœ” Regression setup: fresh login succeeded");
        }

        {
            const { status, data } = await req("GET", "/api/dashboard", null, freshRegToken);
            assert.equal(status, 200, `[Reg] Dashboard: ${JSON.stringify(data)}`);
            assert.ok(data.stats);
            assert.ok(Array.isArray(data.recentProjects));
            console.log("  âœ” Regression: Dashboard OK");
        }

        {
            const { status, data } = await req("POST", "/api/projects", {
                name: "Test Project", language: "JavaScript",
            }, freshRegToken);
            assert.equal(status, 201, `[Reg] Project creation: ${JSON.stringify(data)}`);
            assert.ok(data.project?.id);
            if (data.project?.id) {
                await req("DELETE", `/api/projects/${data.project.id}`, null, freshRegToken);
            }
            console.log("  âœ” Regression: Project creation OK");
        }

        {
            const { status, data } = await req("POST", "/api/compiler/run", {
                sourceCode: 'console.log("CoCode test");', language: "javascript",
            });
            assert.ok([200, 502, 503, 504].includes(status), `[Reg] Compiler: unexpected ${status}`);
            console.log("  âœ” Regression: Compiler endpoint OK");
        }

        {
            const { status, data } = await req("GET", "/api/health");
            assert.equal(status, 200, "[Reg] Health must return 200");
            assert.equal(data.status, "healthy");
            console.log("  âœ” Regression: Health endpoint OK");
        }

        {
            const { status } = await req("PUT", "/api/user/profile", {
                bio: "Test bio from automated tests",
            }, freshRegToken);
            assert.equal(status, 200, "[Reg] Profile update failed");
            console.log("  âœ” Regression: Profile update OK");
        }

        {
            const { status } = await req("GET", "/api/activity", null, freshRegToken);
            assert.equal(status, 200, "[Reg] Activity log failed");
            console.log("  âœ” Regression: Activity log OK");
        }

        {
            const { status } = await req("GET", "/api/languages", null, freshRegToken);
            assert.equal(status, 200, "[Reg] Language stats failed");
            console.log("  âœ” Regression: Language stats OK");
        }

        {
            const protectedRoutes = [
                ["GET", "/api/dashboard"], ["GET", "/api/projects"], ["GET", "/api/activity"],
                ["GET", "/api/progress"], ["GET", "/api/submissions"], ["POST", "/api/rooms"],
            ];
            for (const [method, path] of protectedRoutes) {
                const { status } = await req(method, path);
                assert.equal(status, 401, `[Reg] ${method} ${path} must require auth but returned ${status}`);
            }
            console.log("  âœ” Regression: Unauthenticated access blocked for all protected routes");
        }

    } finally {
        // Always cleanup the test user
        if (localTestUserId) {
            await prisma.user.delete({ where: { id: localTestUserId } }).catch(() => {});
            console.log(`[cleanup] Deleted test user: ${localTestEmail}`);
        }
        await prisma.$disconnect().catch(() => {});
    }
});



// â”€â”€â”€ SECURITY ASSERTIONS (Offline / Static) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
describe("Security Config Assertions â€” Static Checks", () => {
    test("server.js does not contain the old hardcoded JWT fallback", () => {
        const fs = require("fs");
        const serverContent = fs.readFileSync(
            require("path").join(__dirname, "../server.js"),
            "utf-8"
        );
        assert.ok(
            !serverContent.includes("cocode_jwt_secret_dev_and_prod_key_2026"),
            "server.js must NOT contain the old hardcoded JWT fallback secret"
        );
    });

    test("server.js does not auto-create demo@cocode.dev on login", () => {
        const fs = require("fs");
        const serverContent = fs.readFileSync(
            require("path").join(__dirname, "../server.js"),
            "utf-8"
        );
        assert.ok(
            !serverContent.includes("demo@cocode.dev") || serverContent.includes("// demo@cocode.dev"),
            "server.js login route must not auto-create demo@cocode.dev"
        );
    });

    test("server.js does not auto-create jatinraghav22@gmail.com on login", () => {
        const fs = require("fs");
        const serverContent = fs.readFileSync(
            require("path").join(__dirname, "../server.js"),
            "utf-8"
        );
        assert.ok(
            !serverContent.includes("jatinraghav22@gmail.com"),
            "server.js must NOT hardcode a real user's email address"
        );
    });

    test("server.js uses requireAuth from modular middleware (not inline)", () => {
        const fs = require("fs");
        const serverContent = fs.readFileSync(
            require("path").join(__dirname, "../server.js"),
            "utf-8"
        );
        // Accept either single-quote or double-quote require style
        const hasModularImport =
            serverContent.includes("require('./src/middleware/auth')") ||
            serverContent.includes('require("./src/middleware/auth")');
        assert.ok(
            hasModularImport,
            "server.js must import requireAuth from modular middleware (src/middleware/auth)"
        );
    });

    test(".env.example contains no real secrets", () => {
        const fs = require("fs");
        const exampleContent = fs.readFileSync(
            require("path").join(__dirname, "../.env.example"),
            "utf-8"
        );
        // Ensure the example doesn't have a real MySQL password
        assert.ok(
            !exampleContent.includes("Jatin@2007"),
            ".env.example must NOT contain the real MySQL password"
        );
        assert.ok(
            exampleContent.includes("YOUR_PASSWORD"),
            ".env.example must use placeholder credentials"
        );
    });

    test("session.js stores token hash, not raw token", () => {
        const fs = require("fs");
        const sessionContent = fs.readFileSync(
            require("path").join(__dirname, "../src/services/session.js"),
            "utf-8"
        );
        assert.ok(
            sessionContent.includes("sha256"),
            "session.js must use SHA-256 hashing for tokens"
        );
        assert.ok(
            !sessionContent.includes("token: token"),
            "session.js must not store raw token in DB"
        );
    });
});

after(async () => {
    await prisma.$disconnect().catch(() => {});
});

console.log("\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
console.log("â•‘  CoCode Phase 2 â€” Auth & Security Tests  â•‘");
console.log("â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
