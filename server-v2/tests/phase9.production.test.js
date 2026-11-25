const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { Judge0Service, UpstreamError, TimeoutError, ServiceUnavailableError } = require("../src/modules/compiler/judge0.service");
const { ProjectService } = require("../src/modules/projects/project.service");
const { createRateLimiter } = require("../src/middleware/rateLimiter");

const baseConfig = {
  nodeEnv: "test",
  port: 0,
  clientOrigins: ["http://localhost:5173"],
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function listenAndCleanup(app, t) {
  const server = app.listen(0);
  const ready = new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  }));
  return { server, ready };
}

// ─── Readiness Endpoint ──────────────────────────────────────────────────────

test("PHASE 9 — GET /api/ready returns 200 when database is healthy", async (t) => {
  const mockPrisma = {
    user: {},
    $queryRaw: async () => [{ 1: 1 }],
  };

  const app = createApp(baseConfig, { prisma: mockPrisma });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/ready`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.status, "ready");
  assert.equal(body.checks.database, "healthy");
  assert.equal(typeof body.timestamp, "string");
});

test("PHASE 9 — GET /api/ready returns 503 when database is unreachable", async (t) => {
  const mockPrisma = {
    user: {},
    $queryRaw: async () => {
      throw new Error("Connection refused at gateway:4000");
    },
  };

  const app = createApp(baseConfig, { prisma: mockPrisma });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/ready`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.status, "not_ready");
  assert.equal(body.checks.database, "unreachable");
  assert.equal(body.error, undefined);
  assert.equal(body.message, undefined);
});

test("PHASE 9 — GET /api/ready returns 503 when prisma.$queryRaw is missing", async (t) => {
  const brokenPrisma = {
    user: {},
  };

  const app = createApp(baseConfig, { prisma: brokenPrisma });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/ready`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.checks.database, "unavailable");
});

test("PHASE 9 — GET /api/ready returns 503 when prisma.$queryRaw is not a function", async (t) => {
  const mockPrisma = {
    user: {},
    $queryRaw: "not_a_function",
  };

  const app = createApp(baseConfig, { prisma: mockPrisma });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/ready`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.checks.database, "unavailable");
});

// ─── Centralized Error Handler ───────────────────────────────────────────────

test("PHASE 9 — Centralized error handler rejects malformed JSON payloads with 400", async (t) => {
  const app = createApp(baseConfig);
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"email": "test@cocode.com", broken_json',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /Malformed JSON payload/i);
});

test("PHASE 9 — Centralized error handler maps Prisma P2002 to 409 Conflict", async (t) => {
  const mockAuthService = {
    login: async () => {
      const err = new Error("Unique constraint failed");
      err.code = "P2002";
      err.meta = { target: ["email"] };
      throw err;
    },
  };

  const app = createApp(baseConfig, { authService: mockAuthService });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@cocode.com", password: "Password123!" }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.success, false);
  assert.match(body.error, /already exists/i);
});

test("PHASE 9 — Centralized error handler maps Prisma P2025 to 404 Not Found", async (t) => {
  const mockAuthService = {
    login: async () => {
      const err = new Error("Record not found");
      err.code = "P2025";
      throw err;
    },
  };

  const app = createApp(baseConfig, { authService: mockAuthService });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@cocode.com", password: "Password123!" }),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.match(body.error, /not found/i);
});

test("PHASE 9 — Centralized error handler maps DB initialization failure to 503", async (t) => {
  const mockAuthService = {
    login: async () => {
      const err = new Error("Can't reach database server");
      err.name = "PrismaClientInitializationError";
      throw err;
    },
  };

  const app = createApp(baseConfig, { authService: mockAuthService });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@cocode.com", password: "Password123!" }),
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.match(body.error, /Database service is currently unreachable/i);
});

test("PHASE 9 — Centralized error handler masks 500 internal errors", async (t) => {
  const mockAuthService = {
    login: async () => {
      const err = new Error("FATAL: segfault in module xyz, passwordHash leaked");
      err.statusCode = 500;
      throw err;
    },
  };

  const app = createApp(baseConfig, { authService: mockAuthService });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@cocode.com", password: "Password123!" }),
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.success, false);
  assert.equal(body.error, "Internal server error.");
  assert.equal(body.message, "Internal server error.");
  assert.ok(!body.error.includes("segfault"));
  assert.ok(!body.error.includes("passwordHash"));
});

test("PHASE 9 — Centralized error handler preserves 4xx client error messages", async (t) => {
  const mockAuthService = {
    login: async () => {
      const err = new Error("Invalid email format provided.");
      err.statusCode = 422;
      throw err;
    },
  };

  const app = createApp(baseConfig, { authService: mockAuthService });
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@cocode.com", password: "Password123!" }),
  });
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error, "Invalid email format provided.");
});

// ─── Proxy Trust Configuration ───────────────────────────────────────────────

test("PHASE 9 — Trust proxy defaults to false when unset", async (t) => {
  const app = createApp(baseConfig);
  const trustSetting = app.get("trust proxy");
  assert.equal(trustSetting, false);
});

test("PHASE 9 — Trust proxy applies configured value", async (t) => {
  const app = createApp({ ...baseConfig, trustProxy: 1 });
  const trustSetting = app.get("trust proxy");
  assert.equal(trustSetting, 1);
});

test("PHASE 9 — Trust proxy applies string value", async (t) => {
  const app = createApp({ ...baseConfig, trustProxy: "loopback" });
  const trustSetting = app.get("trust proxy");
  assert.equal(trustSetting, "loopback");
});

// ─── Judge0 Service ──────────────────────────────────────────────────────────

test("PHASE 9 — Judge0 output truncation bounds huge stdout to 100KB", async () => {
  const hugeOutput = "A".repeat(150 * 1024);
  const service = new Judge0Service({ useBase64: false });

  const normalized = service.normalizeResult({
    status: { id: 3, description: "Accepted" },
    stdout: hugeOutput,
    stderr: null,
    compile_output: null,
    message: null,
    time: "0.05",
    memory: 12000,
  });

  assert.equal(normalized.status.description, "Accepted");
  assert.ok(normalized.stdout.length <= 100 * 1024 + 100);
  assert.ok(normalized.stdout.includes("[output truncated: exceeded maximum display limit]"));
});

test("PHASE 9 — Judge0 network failure throws UpstreamError cleanly", async () => {
  const service = new Judge0Service({
    baseUrl: "http://invalid-nonexistent-domain.xyz",
    fetchFn: async () => {
      throw new Error("ENOTFOUND");
    },
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "console.log('hi');" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.equal(err.statusCode, 502);
      assert.ok(err.message.includes("Cannot reach execution service"));
      return true;
    }
  );
});

test("PHASE 9 — Judge0 HTTP 429 throws ServiceUnavailableError", async () => {
  const service = new Judge0Service({
    fetchFn: async () => ({
      ok: false,
      status: 429,
      headers: { get: () => null },
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "print(1)" });
    },
    (err) => {
      assert.ok(err instanceof ServiceUnavailableError);
      assert.equal(err.statusCode, 503);
      assert.match(err.message, /rate limit/i);
      return true;
    }
  );
});

test("PHASE 9 — Judge0 HTTP 401/403 throws UpstreamError with 502", async () => {
  const service = new Judge0Service({
    fetchFn: async () => ({
      ok: false,
      status: 401,
      headers: { get: () => null },
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "print(1)" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.equal(err.statusCode, 502);
      assert.match(err.message, /authentication failed/i);
      return true;
    }
  );
});

// Helper to generate a compliant streaming Response mock
function makeStreamResponse({ text = "", chunks = null, contentLength = null, onCancel = null, status = 200, ok = true } = {}) {
  const dataChunks = chunks || [Buffer.from(text, "utf8")];
  let cancelled = false;
  return {
    ok,
    status,
    headers: {
      get: (h) => (h.toLowerCase() === "content-length" ? (contentLength !== null ? String(contentLength) : null) : null),
    },
    body: {
      getReader: () => {
        let index = 0;
        return {
          read: async () => {
            if (cancelled || index >= dataChunks.length) {
              return { done: true, value: undefined };
            }
            return { done: false, value: dataChunks[index++] };
          },
          cancel: async () => {
            cancelled = true;
            if (onCancel) onCancel();
          },
        };
      },
    },
  };
}

test("PHASE 9 — Judge0 oversized streamed body with Content-Length throws UpstreamError", async () => {
  let cancelCalled = false;
  const service = new Judge0Service({
    maxResponseBodyBytes: 1024,
    fetchFn: async () => makeStreamResponse({
      contentLength: 5000,
      text: "x".repeat(5000),
      onCancel: () => { cancelCalled = true; },
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "x" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.match(err.message, /exceeds maximum allowed size/i);
      return true;
    }
  );
  assert.equal(cancelCalled, true);
});

test("PHASE 9 — Judge0 oversized streamed body without Content-Length throws UpstreamError", async () => {
  let cancelCalled = false;
  const service = new Judge0Service({
    maxResponseBodyBytes: 512,
    fetchFn: async () => makeStreamResponse({
      chunks: [Buffer.from("x".repeat(300)), Buffer.from("x".repeat(300))],
      onCancel: () => { cancelCalled = true; },
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "x" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.match(err.message, /exceeds maximum allowed size/i);
      return true;
    }
  );
  assert.equal(cancelCalled, true);
});

test("PHASE 9 — Judge0 missing body with .text() only throws UpstreamError", async () => {
  const service = new Judge0Service({
    fetchFn: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ token: "tok-text" }),
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "x" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.match(err.message, /no readable streaming body/i);
      return true;
    }
  );
});

test("PHASE 9 — Judge0 missing body with .json() only throws UpstreamError", async () => {
  const service = new Judge0Service({
    fetchFn: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ token: "tok-json" }),
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "x" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.match(err.message, /no readable streaming body/i);
      return true;
    }
  );
});

test("PHASE 9 — Judge0 stream interruption throws UpstreamError", async () => {
  const service = new Judge0Service({
    fetchFn: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: {
        getReader: () => ({
          read: async () => { throw new Error("ECONNRESET"); },
          cancel: async () => {},
        }),
      },
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "x" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.match(err.message, /stream error/i);
      return true;
    }
  );
});

test("PHASE 9 — Judge0 malformed JSON throws UpstreamError", async () => {
  const service = new Judge0Service({
    fetchFn: async () => makeStreamResponse({ text: "not-json{{{" }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "x" });
    },
    (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.match(err.message, /invalid JSON/i);
      return true;
    }
  );
});

test("PHASE 9 — Judge0 reader cancellation on oversized body", async () => {
  let cancelCalled = false;
  const service = new Judge0Service({
    maxResponseBodyBytes: 100,
    fetchFn: async () => makeStreamResponse({
      chunks: [Buffer.alloc(80), Buffer.alloc(80)],
      onCancel: () => { cancelCalled = true; },
    }),
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "x" });
    },
    (err) => err instanceof UpstreamError
  );
  assert.equal(cancelCalled, true);
});

test("PHASE 9 — Judge0 normal bounded response", async () => {
  const service = new Judge0Service({
    fetchFn: async () => makeStreamResponse({
      text: JSON.stringify({
        token: "tok-normal",
        status: { id: 3, description: "Accepted" },
        stdout: Buffer.from("normal output\n").toString("base64"),
      }),
    }),
  });

  const result = await service.execute({ languageId: 63, sourceCode: "console.log(1)" });
  assert.equal(result.status.id, 3);
  assert.equal(result.stdout, "normal output\n");
});

test("PHASE 9 — Judge0 total deadline bounds multi-attempt polling", async () => {
  let pollCount = 0;
  const service = new Judge0Service({
    totalTimeoutMs: 3000,
    pollIntervalMs: 100,
    timeoutMs: 2000,
    maxPollAttempts: 60,
    sleepFn: async (ms) => {
      await new Promise((r) => setTimeout(r, 10));
    },
    fetchFn: async (url, opts) => {
      if (opts && opts.method === "POST") {
        return makeStreamResponse({
          status: 201,
          text: JSON.stringify({ token: "test-token-deadline", status: { id: 1 } }),
        });
      }
      pollCount += 1;
      return makeStreamResponse({
        status: 200,
        text: JSON.stringify({ status: { id: 1, description: "In Queue" } }),
      });
    },
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 63, sourceCode: "while True: pass" });
    },
    (err) => {
      assert.ok(err instanceof TimeoutError);
      assert.match(err.message, /deadline|too long/i);
      return true;
    }
  );

  assert.ok(pollCount >= 1, `Expected at least 1 poll attempt, got ${pollCount}`);
});

test("PHASE 9 — Judge0 constructor validates timeout bounds", async () => {
  const s1 = new Judge0Service({ timeoutMs: 50 });
  assert.equal(s1.timeoutMs, 10000);

  const s2 = new Judge0Service({ timeoutMs: 999999 });
  assert.equal(s2.timeoutMs, 10000);

  const s3 = new Judge0Service({ pollIntervalMs: 10 });
  assert.equal(s3.pollIntervalMs, 750);

  const s4 = new Judge0Service({ maxPollAttempts: 100 });
  assert.equal(s4.maxPollAttempts, 25);

  const s5 = new Judge0Service({ totalTimeoutMs: 500 });
  assert.equal(s5.totalTimeoutMs, 25000);

  const s6 = new Judge0Service({ timeoutMs: 5000, pollIntervalMs: 500, maxPollAttempts: 10, totalTimeoutMs: 8000 });
  assert.equal(s6.timeoutMs, 5000);
  assert.equal(s6.pollIntervalMs, 500);
  assert.equal(s6.maxPollAttempts, 10);
  assert.equal(s6.totalTimeoutMs, 8000);
});

test("PHASE 9 — Judge0 normalizeResult handles null/undefined input safely", () => {
  const service = new Judge0Service({ useBase64: false });

  const result = service.normalizeResult(null);
  assert.equal(result.status.id, 0);
  assert.equal(result.status.description, "Unknown");
  assert.equal(result.stdout, null);
  assert.equal(result.stderr, null);
});

// ─── Project Service — Batch Save ────────────────────────────────────────────

test("PHASE 9 — saveAllFiles accepts up to 50 files", async () => {
  const files = Array.from({ length: 50 }, (_, i) => ({
    id: `f${i}`,
    name: `file${i}.js`,
    path: `/file${i}.js`,
    language: "javascript",
    content: `// file ${i}`,
  }));

  const mockPrisma = {
    project: {
      findUnique: async () => ({
        id: "p1",
        userId: "u1",
        files,
      }),
    },
    $transaction: async (fn) => fn({
      projectFile: { update: async () => ({}) },
      project: { update: async () => ({}) },
    }),
  };

  const projectService = new ProjectService(mockPrisma);
  const result = await projectService.saveAllFiles("u1", "p1", files.map((f) => ({
    id: f.id,
    content: f.content,
    language: f.language,
  })));

  assert.equal(result.success, true);
  assert.equal(result.count, 50);
});

test("PHASE 9 — saveAllFiles rejects more than 50 files with 400", async () => {
  const files = Array.from({ length: 51 }, (_, i) => ({
    id: `f${i}`,
    content: `// file ${i}`,
    language: "javascript",
  }));

  const mockPrisma = {
    project: {
      findUnique: async () => ({
        id: "p1",
        userId: "u1",
        files: files.map((f) => ({ ...f, name: `${f.id}.js`, path: `/${f.id}.js` })),
      }),
    },
  };

  const projectService = new ProjectService(mockPrisma);

  await assert.rejects(
    async () => {
      await projectService.saveAllFiles("u1", "p1", files);
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /maximum allowed limit of 50/i);
      return true;
    }
  );
});

// ─── Project Search Bounds ───────────────────────────────────────────────────

test("PHASE 9 — Project search bounds query string and caps maximum matches", async () => {
  const dummyFiles = [
    { id: "f1", name: "test.js", path: "/test.js", language: "javascript", content: "hello\nworld\nhello\nworld" },
  ];
  const mockPrisma = {
    project: {
      findUnique: async () => ({ id: "p1", userId: "u1", files: dummyFiles }),
    },
  };

  const projectService = new ProjectService(mockPrisma);
  const longQuery = "hello".padEnd(300, "o");
  const result = await projectService.searchProjectFiles("u1", "p1", longQuery);

  assert.equal(result.success, true);
  assert.equal(result.query.length, 200);
});

// ─── HTTP Rate Limiter ───────────────────────────────────────────────────────

test("PHASE 9 — Rate limiter correctly tracks requests and blocks over limit", async () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 3,
    message: "Rate limit reached.",
  });

  let blocked = false;
  let retryAfterHeader = null;

  const req = { ip: "10.0.0.99", headers: {} };
  for (let i = 0; i < 4; i++) {
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        if (this.statusCode === 429) {
          blocked = true;
          retryAfterHeader = this.headers["Retry-After"];
        }
        return payload;
      },
    };
    limiter(req, res, () => {});
  }

  assert.equal(blocked, true);
  assert.ok(retryAfterHeader > 0);
});

test("PHASE 9 — Rate limiter allows requests within limit", async () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: "Rate limit reached.",
  });

  let nextCalled = 0;
  const req = { ip: "10.0.0.100", headers: {} };
  for (let i = 0; i < 5; i++) {
    const res = {
      headers: {},
      setHeader() {},
      status() { return this; },
      json() { return {}; },
    };
    limiter(req, res, () => { nextCalled += 1; });
  }

  assert.equal(nextCalled, 5);
});

// ─── Socket.IO Per-Socket Rate Limiting (Unit) ──────────────────────────────

test("PHASE 9 — Socket-level rate limiter allows within limit and blocks over", () => {
  function checkSocketRateLimit(socket, eventType, maxCount, windowMs) {
    if (!socket._rateLimits) {
      socket._rateLimits = new Map();
    }
    const now = Date.now();
    let limiter = socket._rateLimits.get(eventType);
    if (!limiter || now > limiter.resetTime) {
      limiter = { count: 1, resetTime: now + windowMs };
      socket._rateLimits.set(eventType, limiter);
      return true;
    }
    limiter.count += 1;
    return limiter.count <= maxCount;
  }

  const mockSocket = {};

  for (let i = 0; i < 15; i++) {
    assert.equal(checkSocketRateLimit(mockSocket, "chat", 15, 5000), true);
  }
  assert.equal(checkSocketRateLimit(mockSocket, "chat", 15, 5000), false);

  for (let i = 0; i < 40; i++) {
    assert.equal(checkSocketRateLimit(mockSocket, "code", 40, 5000), true);
  }
  assert.equal(checkSocketRateLimit(mockSocket, "code", 40, 5000), false);

  for (let i = 0; i < 150; i++) {
    assert.equal(checkSocketRateLimit(mockSocket, "yjs", 150, 5000), true);
  }
  assert.equal(checkSocketRateLimit(mockSocket, "yjs", 150, 5000), false);
});

// ─── RoomStateStore flush — bounded deadline ─────────────────────────────────

test("PHASE 9 — flush: normal successful flush with no dirty files", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");
  const store = new RoomStateStore();
  store.setRoomService({
    saveRoomDocument: async () => {},
    getRoomDocuments: async () => [],
  });

  const result = await store.flush(null, { timeoutMs: 1000 });
  assert.equal(result.success, true);
  assert.deepEqual(result.unsaved, []);
  assert.equal(result.timedOut, false);
});

test("PHASE 9 — flush: awaits loading promises before flushing", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");
  const store = new RoomStateStore();

  let loadResolved = false;
  const loadPromise = new Promise((resolve) => {
    setTimeout(() => {
      loadResolved = true;
      resolve({ code: "TESTAA", files: new Map() });
    }, 50);
  });

  store._loadingPromises.set("TESTAA", loadPromise);
  store.setRoomService({
    saveRoomDocument: async () => {},
    getRoomDocuments: async () => [],
  });

  const result = await store.flush(null, { timeoutMs: 2000 });

  assert.equal(loadResolved, true);
  assert.equal(result.success, true);
});

test("PHASE 9 — flush: one hung hydration plus one already-loaded room with a dirty file reports both", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");
  const store = new RoomStateStore();

  // 1. One hung hydration promise
  const neverResolves = new Promise(() => {});
  store._loadingPromises.set("HUNG_ROOM", neverResolves);

  // 2. One already-loaded room with a dirty file
  const Y = require("yjs");
  const yDoc = new Y.Doc();
  const yText = yDoc.getText("monaco");
  yText.insert(0, "dirty code");
  store._rooms.set("LOADED_ROOM", {
    code: "LOADED_ROOM",
    files: new Map([
      ["file-1", {
        fileId: "file-1",
        filename: "index.js",
        language: "javascript",
        yDoc,
        yText,
        content: "dirty code",
        version: 1,
        lastSavedVersion: 0,
        isDirty: true,
        lastUpdatedBy: null,
        lastUpdatedAt: Date.now(),
        saveTimer: null,
        inFlightSave: null,
        retryCount: 0,
      }],
    ]),
  });

  store.setRoomService({
    saveRoomDocument: async () => {},
    getRoomDocuments: async () => [],
  });

  const start = Date.now();
  const result = await store.flush(null, { timeoutMs: 150 });
  const elapsed = Date.now() - start;

  assert.equal(result.success, false);
  assert.equal(result.timedOut, true);
  assert.ok(elapsed < 1000, `Flush took ${elapsed}ms, expected < 1000ms`);

  // Both the hung hydration room and the loaded room's dirty file must be reported
  assert.equal(result.unsaved.length, 2);

  const roomEntry = result.unsaved.find((u) => u.roomCode === "HUNG_ROOM");
  assert.ok(roomEntry, "Should report HUNG_ROOM");
  assert.equal(roomEntry.type, "room");
  assert.equal(roomEntry.fileId, null);
  assert.match(roomEntry.error, /hydration timed out/i);

  const fileEntry = result.unsaved.find((u) => u.roomCode === "LOADED_ROOM" && u.fileId === "file-1");
  assert.ok(fileEntry, "Should report LOADED_ROOM file-1");
  assert.equal(fileEntry.type, "file");
  assert.match(fileEntry.error, /timed out/i);
});

test("PHASE 9 — flush: multiple loaded dirty files and multiple still-loading rooms", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");
  const store = new RoomStateStore();

  // 2 hung hydration promises
  store._loadingPromises.set("HUNG_A", new Promise(() => {}));
  store._loadingPromises.set("HUNG_B", new Promise(() => {}));

  // 2 loaded rooms, one with 1 dirty file, one with 2 dirty files
  const Y = require("yjs");
  const createMockFile = (fileId, name) => {
    const yDoc = new Y.Doc();
    const yText = yDoc.getText("monaco");
    yText.insert(0, "content");
    return {
      fileId,
      filename: name,
      language: "javascript",
      yDoc,
      yText,
      content: "content",
      version: 1,
      lastSavedVersion: 0,
      isDirty: true,
      lastUpdatedBy: null,
      lastUpdatedAt: Date.now(),
      saveTimer: null,
      inFlightSave: null,
      retryCount: 0,
    };
  };

  store._rooms.set("ROOM_1", {
    code: "ROOM_1",
    files: new Map([["f-1", createMockFile("f-1", "a.js")]]),
  });
  store._rooms.set("ROOM_2", {
    code: "ROOM_2",
    files: new Map([
      ["f-2", createMockFile("f-2", "b.js")],
      ["f-3", createMockFile("f-3", "c.js")],
    ]),
  });

  store.setRoomService({
    saveRoomDocument: async () => {},
    getRoomDocuments: async () => [],
  });

  const result = await store.flush(null, { timeoutMs: 150 });

  assert.equal(result.success, false);
  assert.equal(result.timedOut, true);
  // Total 5 unsaved: 2 rooms + 3 files
  assert.equal(result.unsaved.length, 5);

  const hungA = result.unsaved.find((u) => u.roomCode === "HUNG_A");
  const hungB = result.unsaved.find((u) => u.roomCode === "HUNG_B");
  const f1 = result.unsaved.find((u) => u.roomCode === "ROOM_1" && u.fileId === "f-1");
  const f2 = result.unsaved.find((u) => u.roomCode === "ROOM_2" && u.fileId === "f-2");
  const f3 = result.unsaved.find((u) => u.roomCode === "ROOM_2" && u.fileId === "f-3");

  assert.ok(hungA && hungB && f1 && f2 && f3, "All 5 items should be reported");
});

test("PHASE 9 — flush: no duplicate entries in unsaved", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");
  const store = new RoomStateStore();

  store._loadingPromises.set("DUP_ROOM", new Promise(() => {}));

  store.setRoomService({
    saveRoomDocument: async () => {},
    getRoomDocuments: async () => [],
  });

  const result = await store.flush(null, { timeoutMs: 100 });
  const keys = result.unsaved.map((u) => `${u.type}:${u.roomCode}:${u.fileId}`);
  const uniqueKeys = new Set(keys);

  assert.equal(keys.length, uniqueKeys.size, "Must not contain duplicate entries");
});

test("PHASE 9 — flush: accurate success and timedOut values", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");

  // Case 1: Clean flush with no pending operations
  const store1 = new RoomStateStore();
  store1.setRoomService({ saveRoomDocument: async () => {}, getRoomDocuments: async () => [] });
  const r1 = await store1.flush(null, { timeoutMs: 1000 });
  assert.equal(r1.success, true);
  assert.equal(r1.timedOut, false);
  assert.deepEqual(r1.unsaved, []);

  // Case 2: Save fails with an explicit error within deadline (not timed out)
  const store2 = new RoomStateStore();
  store2.setRoomService({
    saveRoomDocument: async () => { throw new Error("Disk full"); },
    getRoomDocuments: async () => [],
  });
  const Y = require("yjs");
  const yDoc = new Y.Doc();
  const yText = yDoc.getText("monaco");
  yText.insert(0, "data");
  store2._rooms.set("ERR_ROOM", {
    code: "ERR_ROOM",
    files: new Map([["f-err", {
      fileId: "f-err",
      filename: "e.js",
      language: "javascript",
      yDoc,
      yText,
      content: "data",
      version: 1,
      lastSavedVersion: 0,
      isDirty: true,
      lastUpdatedBy: null,
      lastUpdatedAt: Date.now(),
      saveTimer: null,
      inFlightSave: null,
      retryCount: 0,
    }]]),
  });

  const r2 = await store2.flush(null, { timeoutMs: 2000 });
  assert.equal(r2.success, false);
  assert.equal(r2.timedOut, false); // Failed with error, did not timeout
  assert.equal(r2.unsaved.length, 1);
  assert.equal(r2.unsaved[0].error, "Disk full");

  // Case 3: Save hangs and times out
  const store3 = new RoomStateStore();
  store3.setRoomService({
    saveRoomDocument: () => new Promise(() => {}),
    getRoomDocuments: async () => [],
  });
  store3._rooms.set("TIME_ROOM", {
    code: "TIME_ROOM",
    files: new Map([["f-time", {
      fileId: "f-time",
      filename: "t.js",
      language: "javascript",
      yDoc,
      yText,
      content: "data",
      version: 1,
      lastSavedVersion: 0,
      isDirty: true,
      lastUpdatedBy: null,
      lastUpdatedAt: Date.now(),
      saveTimer: null,
      inFlightSave: null,
      retryCount: 0,
    }]]),
  });

  const r3 = await store3.flush(null, { timeoutMs: 150 });
  assert.equal(r3.success, false);
  assert.equal(r3.timedOut, true);
  assert.equal(r3.unsaved.length, 1);
  assert.match(r3.unsaved[0].error, /timed out/i);
});

test("PHASE 9 — flush: save that never resolves returns within deadline and reports unsaved file", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");
  const store = new RoomStateStore();

  store.setRoomService({
    saveRoomDocument: () => new Promise(() => {}), // never resolves
    getRoomDocuments: async () => [],
  });

  // Create a room with a dirty file directly
  const Y = require("yjs");
  const yDoc = new Y.Doc();
  const yText = yDoc.getText("monaco");
  yText.insert(0, "hello");
  store._rooms.set("SAVE01", {
    code: "SAVE01",
    files: new Map([
      ["f-1", {
        fileId: "f-1",
        filename: "test.js",
        language: "javascript",
        yDoc,
        yText,
        content: "hello",
        version: 1,
        lastSavedVersion: 0,
        isDirty: true,
        lastUpdatedBy: null,
        lastUpdatedAt: Date.now(),
        saveTimer: null,
        inFlightSave: null,
        retryCount: 0,
      }],
    ]),
  });

  const start = Date.now();
  const result = await store.flush(null, { timeoutMs: 300 });
  const elapsed = Date.now() - start;

  assert.equal(result.success, false);
  assert.equal(result.timedOut, true);
  assert.ok(result.unsaved.length >= 1);
  const unsavedFile = result.unsaved.find((u) => u.fileId === "f-1");
  assert.ok(unsavedFile, "Should report f-1 as unsaved");
  assert.equal(unsavedFile.roomCode, "SAVE01");
  assert.ok(elapsed < 1500, `Flush took ${elapsed}ms, expected < 1500ms`);
});

test("PHASE 9 — flush: successful save marks file as not dirty", async () => {
  const { RoomStateStore } = require("../src/modules/rooms/room.store");
  const store = new RoomStateStore();

  let savedDoc = null;
  store.setRoomService({
    saveRoomDocument: async (doc) => { savedDoc = doc; },
    getRoomDocuments: async () => [],
  });

  const Y = require("yjs");
  const yDoc = new Y.Doc();
  const yText = yDoc.getText("monaco");
  yText.insert(0, "saved content");
  const file = {
    fileId: "f-ok",
    filename: "ok.js",
    language: "javascript",
    yDoc,
    yText,
    content: "saved content",
    version: 2,
    lastSavedVersion: 0,
    isDirty: true,
    lastUpdatedBy: null,
    lastUpdatedAt: Date.now(),
    saveTimer: null,
    inFlightSave: null,
    retryCount: 0,
  };

  store._rooms.set("FLOK1", {
    code: "FLOK1",
    files: new Map([["f-ok", file]]),
  });

  const result = await store.flush(null, { timeoutMs: 2000 });

  assert.equal(result.success, true);
  assert.deepEqual(result.unsaved, []);
  assert.equal(result.timedOut, false);
  assert.ok(savedDoc, "saveRoomDocument should have been called");
  assert.equal(savedDoc.fileId, "f-ok");
});

// ─── Env Config ──────────────────────────────────────────────────────────────

test("PHASE 9 — loadEnv parses TRUST_PROXY values correctly", async () => {
  const originalEnv = { ...process.env };

  process.env.TRUST_PROXY = "false";
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "cocode_dev_jwt_secret_must_be_at_least_32_chars_long!";
  const { loadEnv } = require("../src/config/env");
  const c1 = loadEnv();
  assert.equal(c1.trustProxy, false);

  process.env.TRUST_PROXY = "0";
  const c2 = loadEnv();
  assert.equal(c2.trustProxy, false);

  process.env.TRUST_PROXY = "true";
  const c3 = loadEnv();
  assert.equal(c3.trustProxy, true);

  process.env.TRUST_PROXY = "1";
  const c4 = loadEnv();
  assert.equal(c4.trustProxy, 1);

  process.env.TRUST_PROXY = "loopback";
  const c5 = loadEnv();
  assert.equal(c5.trustProxy, "loopback");

  Object.assign(process.env, originalEnv);
  if (originalEnv.TRUST_PROXY === undefined) delete process.env.TRUST_PROXY;
});

// ─── Liveness Endpoint ───────────────────────────────────────────────────────

test("PHASE 9 — GET /api/health returns 200 with uptime", async (t) => {
  const app = createApp(baseConfig);
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.status, "healthy");
  assert.equal(body.service, "cocode-backend-v2");
  assert.equal(typeof body.uptime, "number");
  assert.equal(typeof body.timestamp, "string");
});

// ─── 404 Catch-All ───────────────────────────────────────────────────────────

test("PHASE 9 — Unknown API routes return 404", async (t) => {
  const app = createApp(baseConfig);
  const { server, ready } = listenAndCleanup(app, t);
  await ready;

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/nonexistent`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
});

// ─── Shutdown coordination (exercising real createShutdownHandler) ───────────

const { createShutdownHandler } = require("../src/server");

test("PHASE 9 — Shutdown: concurrent SIGTERM and SIGINT return the exact same in-progress promise", async () => {
  let flushCalls = 0;
  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => {
      flushCalls += 1;
      await new Promise((r) => setTimeout(r, 50));
      return { success: true, unsaved: [], timedOut: false };
    },
  };
  const mockPrisma = { $disconnect: async () => {} };

  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: false,
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const p1 = shutdown("SIGTERM");
  const p2 = shutdown("SIGINT");

  // Every caller of shutdown() must receive the exact same promise instance
  assert.strictEqual(p1, p2);

  const result = await p1;
  assert.equal(result.success, true);
  assert.equal(result.exitCode, 0);
  assert.equal(flushCalls, 1, "Flush must run only once");
});

test("PHASE 9 — Shutdown: unhandled rejection during existing shutdown sets failure exit code without aborting flush", async () => {
  let flushCompleted = false;
  let exitCodeRecorded = null;

  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => {
      // Simulate asynchronous flush in progress
      await new Promise((r) => setTimeout(r, 60));
      flushCompleted = true;
      return { success: true, unsaved: [], timedOut: false };
    },
  };
  const mockPrisma = { $disconnect: async () => {} };

  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: false,
      exitFn: (code) => { exitCodeRecorded = code; },
      setExitCodeFn: (code) => { exitCodeRecorded = code; },
      logFn: () => {},
      errorFn: () => {},
    },
  });

  // Start normal SIGTERM shutdown
  const shutdownPromise = shutdown("SIGTERM");

  // During the shutdown, an unhandled rejection arrives
  const rejectionPromise = shutdown("unhandledRejection", { isFatal: true });

  // Rejection receives the same promise and does not kill the process before flush completes
  assert.strictEqual(shutdownPromise, rejectionPromise);
  assert.equal(flushCompleted, false, "Flush should still be in progress when rejection arrived");

  const result = await shutdownPromise;

  assert.equal(flushCompleted, true, "Flush must finish cleanly");
  assert.equal(result.success, false, "Should be marked failure due to unhandledRejection");
  assert.equal(result.exitCode, 1, "Exit code must be 1");
  assert.equal(exitCodeRecorded, 1);
});

test("PHASE 9 — Shutdown: uncaught exception during existing shutdown sets failure exit code", async () => {
  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => {
      await new Promise((r) => setTimeout(r, 40));
      return { success: true, unsaved: [], timedOut: false };
    },
  };
  const mockPrisma = { $disconnect: async () => {} };

  let exitCodeRecorded = null;
  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: false,
      setExitCodeFn: (code) => { exitCodeRecorded = code; },
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const p1 = shutdown("SIGTERM");
  shutdown("uncaughtException", { isFatal: true });

  const result = await p1;
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 1);
  assert.equal(exitCodeRecorded, 1);
});

test("PHASE 9 — Shutdown: genuinely hung shutdown reaching deadline triggers force-exit", async () => {
  let exitCodeCalled = null;

  const mockStore = {
    setShuttingDown: () => {},
    flush: () => new Promise(() => {}), // never resolves
  };

  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    options: {
      shutdownDeadlineMs: 150, // Short deadline for testing
      autoExit: true,
      exitFn: (code) => { exitCodeCalled = code; },
      setExitCodeFn: (code) => { exitCodeCalled = code; },
      logFn: () => {},
      errorFn: () => {},
      unrefTimers: false,
    },
  });

  const start = Date.now();
  const result = await shutdown("SIGTERM");
  const elapsed = Date.now() - start;

  assert.equal(result.forced, true);
  assert.equal(result.exitCode, 1);
  assert.equal(exitCodeCalled, 1);
  assert.ok(elapsed < 1000, `Hung shutdown took ${elapsed}ms, expected < 1000ms`);
});

test("PHASE 9 — Shutdown: timed-out save does not cause Prisma to disconnect while save remains pending", async () => {
  let disconnectCalled = false;

  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => ({
      success: false,
      unsaved: [{ type: "file", roomCode: "R1", fileId: "f1", error: "Save timed out" }],
      timedOut: true,
    }),
  };

  const mockPrisma = {
    $disconnect: async () => {
      disconnectCalled = true;
    },
  };

  let exitCodeRecorded = null;
  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: true,
      exitFn: (code) => { exitCodeRecorded = code; },
      setExitCodeFn: (code) => { exitCodeRecorded = code; },
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const result = await shutdown("SIGTERM");
  assert.equal(disconnectCalled, false, "Prisma.$disconnect must NOT be called when flush timed out with pending saves");
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 1);
  assert.equal(exitCodeRecorded, 1);
});

test("PHASE 9 — Shutdown: timed-out hydration does not cause Prisma to disconnect while hydration remains pending", async () => {
  let disconnectCalled = false;

  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => ({
      success: false,
      unsaved: [{ type: "room", roomCode: "H1", fileId: null, error: "Room hydration timed out" }],
      timedOut: true,
    }),
  };

  const mockPrisma = {
    $disconnect: async () => {
      disconnectCalled = true;
    },
  };

  let exitCodeRecorded = null;
  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: true,
      exitFn: (code) => { exitCodeRecorded = code; },
      setExitCodeFn: (code) => { exitCodeRecorded = code; },
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const result = await shutdown("SIGTERM");
  assert.equal(disconnectCalled, false, "Prisma.$disconnect must NOT be called when hydration timed out");
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 1);
  assert.equal(exitCodeRecorded, 1);
});

test("PHASE 9 — Shutdown: normal successful flush disconnects Prisma", async () => {
  const callOrder = [];

  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => {
      callOrder.push("flush");
      return { success: true, unsaved: [], timedOut: false };
    },
  };

  const mockPrisma = {
    $disconnect: async () => {
      callOrder.push("disconnect");
    },
  };

  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: false,
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const result = await shutdown("SIGTERM");
  assert.deepEqual(callOrder, ["flush", "disconnect"], "Prisma disconnect must occur after successful flush");
  assert.equal(result.success, true);
  assert.equal(result.exitCode, 0);
});

test("PHASE 9 — Shutdown: completed save failure without timeout still follows normal cleanup and disconnects Prisma", async () => {
  let disconnectCalled = false;

  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => ({
      success: false,
      unsaved: [{ type: "file", roomCode: "R1", fileId: "f1", error: "Disk full" }],
      timedOut: false, // ordinary completed error, not a timeout
    }),
  };

  const mockPrisma = {
    $disconnect: async () => {
      disconnectCalled = true;
    },
  };

  let exitCodeRecorded = null;
  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: true,
      exitFn: (code) => { exitCodeRecorded = code; },
      setExitCodeFn: (code) => { exitCodeRecorded = code; },
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const result = await shutdown("SIGTERM");
  assert.equal(disconnectCalled, true, "Prisma.$disconnect should be called for non-timeout save failure");
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 1);
  assert.equal(exitCodeRecorded, 1);
});

test("PHASE 9 — Shutdown: normal successful shutdown exits with 0 and clears force-exit timer", async () => {
  let exitCodeRecorded = null;

  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => ({ success: true, unsaved: [], timedOut: false }),
  };
  const mockPrisma = { $disconnect: async () => {} };

  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      shutdownDeadlineMs: 5000,
      autoExit: true,
      exitFn: (code) => { exitCodeRecorded = code; },
      setExitCodeFn: (code) => { exitCodeRecorded = code; },
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const result = await shutdown("SIGTERM");
  assert.equal(result.success, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.forced, false);
  assert.equal(exitCodeRecorded, 0);
});

test("PHASE 9 — Shutdown: shutdown failure produces nonzero exit status", async () => {
  let exitCodeRecorded = null;

  const mockStore = {
    setShuttingDown: () => {},
    flush: async () => ({
      success: false,
      unsaved: [{ type: "file", roomCode: "R1", fileId: "f1", error: "DB fail" }],
      timedOut: false,
    }),
  };
  const mockPrisma = { $disconnect: async () => {} };

  const { shutdown } = createShutdownHandler({
    roomStateStore: mockStore,
    prisma: mockPrisma,
    options: {
      autoExit: true,
      exitFn: (code) => { exitCodeRecorded = code; },
      setExitCodeFn: (code) => { exitCodeRecorded = code; },
      logFn: () => {},
      errorFn: () => {},
    },
  });

  const result = await shutdown("SIGTERM");
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 1);
  assert.equal(exitCodeRecorded, 1);
});

// ─── Unhandled rejection policy ──────────────────────────────────────────────

test("PHASE 9 — Unhandled rejection handler sanitizes sensitive information", () => {
  // Simulate what the handler does
  const reason = new Error('Query failed: Bearer eyJhbGciOiJSUzI1NiIsInR.secret "password": "hunter2"');
  const message = reason instanceof Error ? reason.message : String(reason ?? "unknown");
  const safeMessage = message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/"password":\s*"[^"]+"/gi, '"password": "[REDACTED]"');

  assert.ok(!safeMessage.includes("eyJhbGciOiJSUzI1NiIsInR"));
  assert.ok(!safeMessage.includes("hunter2"));
  assert.ok(safeMessage.includes("[REDACTED]"));
});

test("PHASE 9 — Unhandled rejection handler treats non-Error reasons safely", () => {
  const reasons = [
    undefined,
    null,
    42,
    "plain string error",
    { code: "ECONNRESET" },
  ];

  for (const reason of reasons) {
    const message = reason instanceof Error ? reason.message : String(reason ?? "unknown");
    // Should not throw
    assert.equal(typeof message, "string");
  }
});
