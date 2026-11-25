"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { signAccessToken } = require("../src/utils/jwt");
const { createRateLimiter } = require("../src/middleware/rateLimiter");
const {
  Judge0Service,
  UpstreamError,
  TimeoutError,
} = require("../src/modules/compiler/judge0.service");

const TEST_SECRET = "test_super_secret_key_at_least_32_characters_long!";

const testConfig = {
  nodeEnv: "test",
  port: 0,
  clientOrigins: ["http://localhost:5173"],
  jwtSecret: TEST_SECRET,
  jwtExpiresIn: "1h",
  jwtIssuer: "cocode-backend-v2",
  jwtAudience: "cocode-client",
};

/**
 * Creates in-memory mock Prisma client.
 */
function createMockPrisma(initialUsers = []) {
  const users = new Map();
  let idCounter = 1;

  for (const u of initialUsers) {
    const id = u.id || `usr_${idCounter++}`;
    users.set(id, {
      id,
      name: u.name,
      email: u.email.toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return {
    user: {
      async findUnique({ where }) {
        if (where.id) {
          return users.get(where.id) || null;
        }
        return null;
      },
    },
  };
}

/**
 * Launches test server on an ephemeral port.
 */
async function createTestServer({ prisma, judge0Service, rateLimiter }) {
  const app = createApp(testConfig, {
    prisma,
    judge0Service,
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const close = () =>
    new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { baseUrl, close };
}

// ============================================================================
// Integration Tests: Compiler Module
// ============================================================================

test("1. POST /api/compiler/run - guest request without Authorization header succeeds with 200", async (t) => {
  const prisma = createMockPrisma([]);
  const mockJudge0Service = {
    async execute({ languageId, sourceCode }) {
      assert.equal(languageId, 100); // Python
      assert.equal(sourceCode, "print('Hello Guest')");
      return {
        status: { id: 3, description: "Accepted" },
        stdout: "Hello Guest\n",
        stderr: null,
        compileOutput: null,
        message: null,
        time: "0.012",
        memory: 3100,
      };
    },
  };

  const { baseUrl, close } = await createTestServer({ prisma, judge0Service: mockJudge0Service });
  t.after(close);

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "python",
      sourceCode: "print('Hello Guest')",
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.stdout, "Hello Guest\n");
  assert.equal(data.status, "Accepted");
});

test("2. GET /api/compiler/languages - guest request without Authorization header returns 200 and language list", async (t) => {
  const prisma = createMockPrisma([]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  const res = await fetch(`${baseUrl}/api/compiler/languages`);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(Array.isArray(data.languages), true);
  assert.equal(data.languages.length, 5);
});

test("2b. Protected endpoints still require authentication (e.g. GET /api/auth/me)", async (t) => {
  const prisma = createMockPrisma([]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
});

test("2c. POST /api/compiler/run - invalid JWT is rejected with 401", async (t) => {
  const prisma = createMockPrisma([]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: "Bearer invalid.malformed.jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: "print('Invalid token test')",
    }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /invalid authentication token/i);
});

test("2d. POST /api/compiler/run - expired JWT is rejected with 401", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_exp", name: "Expired User", email: "expired@example.com" },
  ]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  // Sign token that expired 10 seconds ago
  const jwt = require("jsonwebtoken");
  const expiredToken = jwt.sign(
    { sub: "usr_exp", name: "Expired User", email: "expired@example.com" },
    TEST_SECRET,
    { expiresIn: -10, issuer: "cocode-backend-v2", audience: "cocode-client" }
  );

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${expiredToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: "print('Expired token test')",
    }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /token has expired/i);
});

test("2e. Activity tracking - guest execution does not track user activity while authenticated execution does", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_active", name: "Active User", email: "active@example.com" },
  ]);

  const activityRecords = [];
  const mockActivityService = {
    async trackActivity(payload) {
      activityRecords.push(payload);
      return { id: `act_${activityRecords.length}`, ...payload };
    },
  };

  const mockJudge0Service = {
    async execute() {
      return {
        status: { id: 3, description: "Accepted" },
        stdout: "ok\n",
        stderr: null,
        compileOutput: null,
        time: "0.01",
        memory: 1000,
      };
    },
  };

  const app = createApp(testConfig, {
    prisma,
    judge0Service: mockJudge0Service,
    activityService: mockActivityService,
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 1. Guest execution (no Authorization header)
  const guestRes = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "python", sourceCode: "print(1)" }),
  });
  assert.equal(guestRes.status, 200);

  // Wait a tick for any async background tasks
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(activityRecords.length, 0, "Guest execution must NOT create any activity record");

  // 2. Authenticated execution
  const token = signAccessToken(
    { id: "usr_active", name: "Active User", email: "active@example.com" },
    TEST_SECRET
  );

  const authRes = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ language: "python", sourceCode: "print(2)" }),
  });
  assert.equal(authRes.status, 200);

  await new Promise((r) => setTimeout(r, 20));
  assert.equal(activityRecords.length, 1, "Authenticated execution must create an activity record");
  assert.equal(activityRecords[0].userId, "usr_active");
  assert.equal(activityRecords[0].status, "success");
});

test("3. GET /api/compiler/languages - authenticated request returns 200 and safe language metadata", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/compiler/languages`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(Array.isArray(data.languages), true);
  assert.equal(data.languages.length, 5);

  const pythonLang = data.languages.find((l) => l.key === "python");
  assert.ok(pythonLang);
  assert.equal(pythonLang.name, "Python");
  assert.equal(pythonLang.judge0Id, 100);
  assert.equal(pythonLang.extension, ".py");
});

test("4. POST /api/compiler/run - successful execution with mocked Judge0 returns 200 and normalized output", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);

  const mockJudge0Service = {
    async execute({ languageId, sourceCode, stdin }) {
      assert.equal(languageId, 100); // Python
      assert.equal(sourceCode, "import sys\nprint('Hello ' + sys.stdin.read())");
      assert.equal(stdin, "CoCode");

      return {
        status: { id: 3, description: "Accepted" },
        stdout: "Hello CoCode\n",
        stderr: null,
        compileOutput: null,
        message: null,
        time: "0.025",
        memory: 3400,
      };
    },
  };

  const { baseUrl, close } = await createTestServer({
    prisma,
    judge0Service: mockJudge0Service,
  });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: "import sys\nprint('Hello ' + sys.stdin.read())",
      stdin: "CoCode",
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();

  // Validate envelope
  assert.equal(data.success, true);
  assert.equal(data.data.language, "python");
  assert.equal(data.data.status.id, 3);
  assert.equal(data.data.status.description, "Accepted");
  assert.equal(data.data.stdout, "Hello CoCode\n");
  assert.equal(data.data.stderr, null);
  assert.equal(data.data.time, "0.025");
  assert.equal(data.data.memory, 3400);

  // Validate top-level compatibility fields
  assert.equal(data.status, "Accepted");
  assert.equal(data.stdout, "Hello CoCode\n");
});

test("5. POST /api/compiler/run - compilation error returns 200 with status and diagnostics in compileOutput", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);

  const mockJudge0Service = {
    async execute() {
      return {
        status: { id: 6, description: "Compilation Error" },
        stdout: null,
        stderr: null,
        compileOutput: "calculator.cpp:4:1: error: expected ';' before '}' token",
        message: null,
        time: null,
        memory: null,
      };
    },
  };

  const { baseUrl, close } = await createTestServer({
    prisma,
    judge0Service: mockJudge0Service,
  });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "cpp",
      sourceCode: "int main() { return 0 }",
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status.id, 6);
  assert.equal(data.data.status.description, "Compilation Error");
  assert.match(data.data.compileOutput, /expected ';'/);
  assert.match(data.compileOutput, /expected ';'/);
});

test("6. POST /api/compiler/run - runtime error returns 200 with status and traceback in stderr", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);

  const mockJudge0Service = {
    async execute() {
      return {
        status: { id: 11, description: "Runtime Error (NZEC)" },
        stdout: null,
        stderr: "ZeroDivisionError: division by zero",
        compileOutput: null,
        message: null,
        time: "0.018",
        memory: 2100,
      };
    },
  };

  const { baseUrl, close } = await createTestServer({
    prisma,
    judge0Service: mockJudge0Service,
  });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: "print(10/0)",
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.status.id, 11);
  assert.equal(data.data.status.description, "Runtime Error (NZEC)");
  assert.equal(data.data.stderr, "ZeroDivisionError: division by zero");
  assert.equal(data.stderr, "ZeroDivisionError: division by zero");
});

test("7. POST /api/compiler/run - unsupported language returns 400 Bad Request", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "ruby",
      sourceCode: "puts 'hello'",
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /unsupported/i);
});

test("8. POST /api/compiler/run - missing or empty sourceCode returns 400 Bad Request", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  // Missing sourceCode
  const resMissing = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
    }),
  });
  assert.equal(resMissing.status, 400);

  // Whitespace sourceCode
  const resWhitespace = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: "    \n   ",
    }),
  });
  assert.equal(resWhitespace.status, 400);
  const data = await resWhitespace.json();
  assert.match(data.message, /cannot be empty/i);
});

test("9. POST /api/compiler/run - oversized source code returns 413 Payload Too Large", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);
  const { baseUrl, close } = await createTestServer({ prisma });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const largeCode = "print('hello')\n".repeat(2500); // > 30,000 characters

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: largeCode,
    }),
  });

  assert.equal(res.status, 413);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /maximum allowed size/i);
});

test("10. POST /api/compiler/run - upstream Judge0 unavailable returns 502 Bad Gateway", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);

  const mockJudge0Service = {
    async execute() {
      throw new UpstreamError("Upstream service is down");
    },
  };

  const { baseUrl, close } = await createTestServer({
    prisma,
    judge0Service: mockJudge0Service,
  });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: "print(1)",
    }),
  });

  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /cannot reach the execution service/i);
});

test("11. POST /api/compiler/run - Judge0 timeout returns 504 Gateway Timeout", async (t) => {
  const prisma = createMockPrisma([
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
  ]);

  const mockJudge0Service = {
    async execute() {
      throw new TimeoutError("Judge0 polling timed out");
    },
  };

  const { baseUrl, close } = await createTestServer({
    prisma,
    judge0Service: mockJudge0Service,
  });
  t.after(close);

  const token = signAccessToken(
    { id: "usr_1", name: "Dev User", email: "dev@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/compiler/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "python",
      sourceCode: "print(1)",
    }),
  });

  assert.equal(res.status, 504);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /timed out/i);
});

test("12. RateLimiter - compiler endpoint enforces per-user and per-guest-IP rate limiting", async () => {
  // Test rate limiter specifically with keyGenerator
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 2,
    keyGenerator: (req) => (req.userId ? `user_${req.userId}` : `guest_ip_${req.ip || "127.0.0.1"}`),
  });

  const reqUser1 = { userId: "usr_1", ip: "127.0.0.1", headers: {} };
  const reqUser2 = { userId: "usr_2", ip: "127.0.0.1", headers: {} };
  const reqGuest1 = { userId: null, ip: "192.168.1.100", headers: {} };
  const reqGuest2 = { userId: null, ip: "192.168.1.101", headers: {} };

  let statusUser1 = 200;
  let statusUser2 = 200;
  let statusGuest1 = 200;
  let statusGuest2 = 200;

  const createRes = (cb) => ({
    setHeader: () => {},
    status: (code) => {
      cb(code);
      return { json: () => {} };
    },
  });

  let next1 = 0;
  let next2 = 0;
  let nextG1 = 0;
  let nextG2 = 0;

  // User 1 - Request 1
  limiter(reqUser1, createRes((c) => (statusUser1 = c)), () => { next1 += 1; });
  // User 1 - Request 2
  limiter(reqUser1, createRes((c) => (statusUser1 = c)), () => { next1 += 1; });
  // User 1 - Request 3 (exceeded)
  limiter(reqUser1, createRes((c) => (statusUser1 = c)), () => { next1 += 1; });

  assert.equal(next1, 2);
  assert.equal(statusUser1, 429);

  // User 2 from same IP should NOT be blocked (isolated per-user)
  limiter(reqUser2, createRes((c) => (statusUser2 = c)), () => { next2 += 1; });
  assert.equal(next2, 1);
  assert.equal(statusUser2, 200);

  // Guest 1 - Request 1 & 2
  limiter(reqGuest1, createRes((c) => (statusGuest1 = c)), () => { nextG1 += 1; });
  limiter(reqGuest1, createRes((c) => (statusGuest1 = c)), () => { nextG1 += 1; });
  // Guest 1 - Request 3 (exceeded)
  limiter(reqGuest1, createRes((c) => (statusGuest1 = c)), () => { nextG1 += 1; });
  assert.equal(nextG1, 2);
  assert.equal(statusGuest1, 429);

  // Guest 2 with different IP should NOT be blocked
  limiter(reqGuest2, createRes((c) => (statusGuest2 = c)), () => { nextG2 += 1; });
  assert.equal(nextG2, 1);
  assert.equal(statusGuest2, 200);
});
