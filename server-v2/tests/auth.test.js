const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");
const { signAccessToken } = require("../src/utils/jwt");

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
 * Creates an in-memory mock Prisma client mirroring PrismaClient behavior.
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
      passwordHash: u.passwordHash,
      createdAt: u.createdAt || new Date(),
      updatedAt: u.updatedAt || new Date(),
    });
  }

  return {
    _users: users,
    user: {
      async findUnique({ where, select }) {
        let found = null;
        if (where.id) {
          found = users.get(where.id) || null;
        } else if (where.email) {
          const emailLower = where.email.toLowerCase();
          for (const u of users.values()) {
            if (u.email === emailLower) {
              found = u;
              break;
            }
          }
        }

        if (!found) return null;

        if (select) {
          const selected = {};
          for (const key of Object.keys(select)) {
            if (select[key]) {
              selected[key] = found[key];
            }
          }
          return selected;
        }

        return { ...found };
      },

      async create({ data, select }) {
        const emailLower = data.email.toLowerCase();
        for (const u of users.values()) {
          if (u.email === emailLower) {
            const err = new Error("Unique constraint failed on the fields: (`email`)");
            err.code = "P2002";
            throw err;
          }
        }

        const id = `cuid_${idCounter++}`;
        const record = {
          id,
          name: data.name,
          email: emailLower,
          passwordHash: data.passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        users.set(id, record);

        if (select) {
          const selected = {};
          for (const key of Object.keys(select)) {
            if (select[key]) {
              selected[key] = record[key];
            }
          }
          return selected;
        }

        return { ...record };
      },
    },
  };
}

/**
 * Helper to launch test server on an ephemeral port.
 */
async function createTestServer(prisma) {
  const app = createApp(testConfig, { prisma });
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

test("POST /api/auth/register - successful registration returns 201, token and safe user", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alan Turing",
      email: "alan@example.com",
      password: "SecurePassword123!",
    }),
  });

  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.equal(typeof body.token, "string");
  assert.equal(body.user.name, "Alan Turing");
  assert.equal(body.user.email, "alan@example.com");
  assert.equal(typeof body.user.id, "string");
  assert.equal(body.user.passwordHash, undefined);
  assert.equal(body.user.password, undefined);

  // Check stored in mock prisma
  assert.equal(prisma._users.size, 1);
  const stored = Array.from(prisma._users.values())[0];
  assert.equal(stored.email, "alan@example.com");
  assert.notEqual(stored.passwordHash, "SecurePassword123!");
  assert.equal(await bcrypt.compare("SecurePassword123!", stored.passwordHash), true);
});

test("POST /api/auth/register - duplicate email registration returns 409", async (t) => {
  const passwordHash = await bcrypt.hash("ExistingPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_existing",
      name: "Existing User",
      email: "existing@example.com",
      passwordHash,
    },
  ]);

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Different Name",
      email: "Existing@Example.COM",
      password: "AnotherPassword123",
    }),
  });

  const body = await res.json();

  assert.equal(res.status, 409);
  assert.equal(body.success, false);
  assert.match(body.message, /already exists/i);
});

test("POST /api/auth/register - invalid email returns 400", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "invalid-email-address",
      password: "ValidPassword123",
    }),
  });

  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /valid email/i);
});

test("POST /api/auth/register - weak password returns 400", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const weakPasswords = [
    "short1", // too short (< 8 chars)
    "alllowercasenonumber", // no uppercase, no number
    "ALLUPPERCASENONUMBER", // no lowercase, no number
    "NoNumbersHere", // no number
    "1234567890", // no letters
  ];

  for (const password of weakPasswords) {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        password,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400, `Expected 400 for password: ${password}`);
    assert.equal(body.success, false);
    assert.match(body.message, /Password/i);
  }
});

test("POST /api/auth/login - successful login returns 200, token and safe user", async (t) => {
  const passwordHash = await bcrypt.hash("CorrectPassword123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_login_1",
      name: "Katherine Johnson",
      email: "katherine@example.com",
      passwordHash,
    },
  ]);

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "Katherine@Example.COM",
      password: "CorrectPassword123!",
    }),
  });

  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.token, "string");
  assert.equal(body.user.id, "usr_login_1");
  assert.equal(body.user.name, "Katherine Johnson");
  assert.equal(body.user.email, "katherine@example.com");
  assert.equal(body.user.passwordHash, undefined);
});

test("POST /api/auth/login - incorrect password returns 401 generic error", async (t) => {
  const passwordHash = await bcrypt.hash("CorrectPassword123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_login_2",
      name: "Katherine Johnson",
      email: "katherine@example.com",
      passwordHash,
    },
  ]);

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "katherine@example.com",
      password: "WrongPassword123!",
    }),
  });

  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Invalid email or password.");
});

test("POST /api/auth/login - nonexistent email returns 401 generic error", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nonexistent@example.com",
      password: "AnyPassword123!",
    }),
  });

  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.message, "Invalid email or password.");
});

test("GET /api/auth/me - missing token returns 401", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/me`);
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /token is required/i);
});

test("GET /api/auth/me - invalid token returns 401", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: "Bearer this.is.an.invalid.token" },
  });
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /invalid/i);
});

test("GET /api/auth/me - expired token returns 401", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const expiredToken = signAccessToken(
    { id: "usr_expired", name: "Expired", email: "expired@example.com" },
    TEST_SECRET,
    { expiresIn: "-5s" }
  );

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /expired/i);
});

test("GET /api/auth/me - valid token returns safe user profile without passwordHash", async (t) => {
  const passwordHash = await bcrypt.hash("SafePassword123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_me_1",
      name: "Margaret Hamilton",
      email: "margaret@example.com",
      passwordHash,
    },
  ]);

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const validToken = signAccessToken(
    { id: "usr_me_1", name: "Margaret Hamilton", email: "margaret@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.user.id, "usr_me_1");
  assert.equal(body.user.name, "Margaret Hamilton");
  assert.equal(body.user.email, "margaret@example.com");
  assert.equal(body.user.passwordHash, undefined);
  assert.equal(body.user.password, undefined);
});

test("GET /api/auth/me - token for deleted user returns 401", async (t) => {
  const prisma = createMockPrisma([]); // Empty database
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(
    { id: "usr_deleted", name: "Ghost", email: "ghost@example.com" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /no longer exists/i);
});

test("POST /api/auth/logout - returns 200 and notes stateless strategy", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.match(body.message, /logged out successfully/i);
  assert.match(body.message, /stateless/i);
});
