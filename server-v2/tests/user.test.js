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
 * Creates an in-memory mock Prisma client for user tests.
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

      async update({ where, data, select }) {
        const found = users.get(where.id);
        if (!found) {
          const err = new Error("Record to update not found.");
          err.code = "P2025";
          throw err;
        }

        const updated = {
          ...found,
          ...data,
          updatedAt: new Date(),
        };
        users.set(where.id, updated);

        if (select) {
          const selected = {};
          for (const key of Object.keys(select)) {
            if (select[key]) {
              selected[key] = updated[key];
            }
          }
          return selected;
        }

        return { ...updated };
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
 * Launches test server on an ephemeral port.
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET profile with valid JWT
// ─────────────────────────────────────────────────────────────────────────────
test("1. GET /api/users/me - profile with valid JWT returns 200 and safe profile", async (t) => {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_alice",
      name: "Alice Smith",
      email: "alice@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_alice", name: "Alice Smith", email: "alice@example.com" }, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.user.id, "usr_alice");
  assert.equal(body.user.name, "Alice Smith");
  assert.equal(body.user.email, "alice@example.com");
  assert.ok(body.user.createdAt);
  assert.ok(body.user.updatedAt);
  assert.equal(body.user.passwordHash, undefined);
  assert.equal(body.user.password, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET profile without token
// ─────────────────────────────────────────────────────────────────────────────
test("2. GET /api/users/me - missing token returns 401 Unauthorized", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/users/me`);
  const body = await res.json();

  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /Authentication token is required/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET profile with invalid token
// ─────────────────────────────────────────────────────────────────────────────
test("3. GET /api/users/me - invalid or tampered token returns 401 Unauthorized", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  // Invalid token string
  const resInvalid = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: "Bearer totally.invalid.token" },
  });
  const bodyInvalid = await resInvalid.json();
  assert.equal(resInvalid.status, 401);
  assert.equal(bodyInvalid.success, false);
  assert.match(bodyInvalid.message, /Invalid authentication token/);

  // Token signed with wrong secret
  const wrongSecretToken = signAccessToken({ id: "usr_alice" }, "wrong_secret_at_least_32_characters_long!");
  const resWrong = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${wrongSecretToken}` },
  });
  const bodyWrong = await resWrong.json();
  assert.equal(resWrong.status, 401);
  assert.equal(bodyWrong.success, false);
  assert.match(bodyWrong.message, /Invalid authentication token/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET profile when user does not exist
// ─────────────────────────────────────────────────────────────────────────────
test("4. GET /api/users/me - valid JWT for non-existent user returns 404 Not Found", async (t) => {
  const prisma = createMockPrisma([]); // No users in DB
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_deleted_or_nonexistent" }, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  assert.equal(res.status, 404);
  assert.equal(body.success, false);
  assert.match(body.message, /User not found/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Update own profile successfully
// ─────────────────────────────────────────────────────────────────────────────
test("5. PATCH /api/users/me - update own profile successfully returns 200 and updated safe profile", async (t) => {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_bob",
      name: "Original Bob",
      email: "bob@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_bob" }, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "  Robert Martin  ",
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Profile updated successfully.");
  assert.equal(body.user.id, "usr_bob");
  assert.equal(body.user.name, "Robert Martin"); // Trimmed
  assert.equal(body.user.email, "bob@example.com");
  assert.equal(body.user.passwordHash, undefined);

  // Verify in Prisma mock
  const stored = prisma._users.get("usr_bob");
  assert.equal(stored.name, "Robert Martin");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Reject invalid profile name
// ─────────────────────────────────────────────────────────────────────────────
test("6. PATCH /api/users/me - reject invalid profile name with 400 Bad Request", async (t) => {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_bob",
      name: "Bob Martin",
      email: "bob@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_bob" }, TEST_SECRET);

  // Name too short (< 2 chars)
  const resShort = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "B" }),
  });
  const bodyShort = await resShort.json();
  assert.equal(resShort.status, 400);
  assert.equal(bodyShort.success, false);
  assert.match(bodyShort.message, /Name must be at least 2 characters/);

  // Whitespace only
  const resWhitespace = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "    " }),
  });
  assert.equal(resWhitespace.status, 400);

  // Name too long (> 50 chars)
  const resLong = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "B".repeat(51) }),
  });
  const bodyLong = await resLong.json();
  assert.equal(resLong.status, 400);
  assert.match(bodyLong.message, /cannot exceed 50 characters/);

  // Name is not a string
  const resNumber = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: 12345 }),
  });
  assert.equal(resNumber.status, 400);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Reject unexpected update fields
// ─────────────────────────────────────────────────────────────────────────────
test("7. PATCH /api/users/me - reject unexpected update fields with 400 Bad Request", async (t) => {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_bob",
      name: "Bob Martin",
      email: "bob@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_bob" }, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Valid Bob",
      role: "admin",
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Unexpected field: 'role'/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Reject attempts to modify email
// ─────────────────────────────────────────────────────────────────────────────
test("8. PATCH /api/users/me - reject attempts to modify email with 400 Bad Request", async (t) => {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_bob",
      name: "Bob Martin",
      email: "bob@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_bob" }, TEST_SECRET);

  // Attempting to change email only
  const resEmailOnly = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "newbob@example.com" }),
  });
  const bodyEmailOnly = await resEmailOnly.json();
  assert.equal(resEmailOnly.status, 400);
  assert.equal(bodyEmailOnly.success, false);
  assert.match(bodyEmailOnly.message, /Email cannot be updated/);

  // Attempting to change name and email
  const resBoth = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Bob New", email: "newbob@example.com" }),
  });
  const bodyBoth = await resBoth.json();
  assert.equal(resBoth.status, 400);
  assert.match(bodyBoth.message, /Email cannot be updated/);

  // Verify email unchanged in DB
  const stored = prisma._users.get("usr_bob");
  assert.equal(stored.email, "bob@example.com");
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Verify one user cannot update another user's account
// ─────────────────────────────────────────────────────────────────────────────
test("9. PATCH /api/users/me - verify one user cannot update another user's account", async (t) => {
  const hashA = await bcrypt.hash("PassUserA1!", 10);
  const hashB = await bcrypt.hash("PassUserB1!", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_attacker",
      name: "Attacker User",
      email: "attacker@example.com",
      passwordHash: hashA,
    },
    {
      id: "usr_victim",
      name: "Victim User",
      email: "victim@example.com",
      passwordHash: hashB,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const tokenAttacker = signAccessToken({ id: "usr_attacker" }, TEST_SECRET);

  // Attacker attempts to provide victim's id in request body
  const resTamper = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenAttacker}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: "usr_victim",
      name: "Compromised Name",
    }),
  });

  assert.equal(resTamper.status, 400);

  // Victim's record is completely untouched
  const victim = prisma._users.get("usr_victim");
  assert.equal(victim.name, "Victim User");

  // Attacker updates legitimately
  const resLegit = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenAttacker}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Attacker Renamed",
    }),
  });
  assert.equal(resLegit.status, 200);

  // Attacker updated, victim untouched
  assert.equal(prisma._users.get("usr_attacker").name, "Attacker Renamed");
  assert.equal(prisma._users.get("usr_victim").name, "Victim User");
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Change password successfully
// ─────────────────────────────────────────────────────────────────────────────
test("10. PATCH /api/users/me/password - change password successfully", async (t) => {
  const passwordHash = await bcrypt.hash("CurrentPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_charlie",
      name: "Charlie",
      email: "charlie@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_charlie" }, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "NewPassword456",
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Password changed successfully.");

  // Verify DB hash changed and matches new password
  const stored = prisma._users.get("usr_charlie");
  assert.notEqual(stored.passwordHash, passwordHash);
  assert.equal(await bcrypt.compare("NewPassword456", stored.passwordHash), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Reject incorrect current password
// ─────────────────────────────────────────────────────────────────────────────
test("11. PATCH /api/users/me/password - reject incorrect current password with 400 Bad Request", async (t) => {
  const passwordHash = await bcrypt.hash("CurrentPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_charlie",
      name: "Charlie",
      email: "charlie@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_charlie" }, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "WrongPassword999",
      newPassword: "NewPassword456",
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Incorrect current password/);

  // Hash unchanged
  const stored = prisma._users.get("usr_charlie");
  assert.equal(stored.passwordHash, passwordHash);
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Reject weak new password
// ─────────────────────────────────────────────────────────────────────────────
test("12. PATCH /api/users/me/password - reject weak new password with 400 Bad Request", async (t) => {
  const passwordHash = await bcrypt.hash("CurrentPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_charlie",
      name: "Charlie",
      email: "charlie@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_charlie" }, TEST_SECRET);

  // Too short
  const resShort = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "Short1",
    }),
  });
  const bodyShort = await resShort.json();
  assert.equal(resShort.status, 400);
  assert.match(bodyShort.message, /at least 8 characters/);

  // Missing uppercase
  const resNoUpper = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "nouppercase123",
    }),
  });
  assert.equal(resNoUpper.status, 400);

  // Missing lowercase
  const resNoLower = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "NOLOWERCASE123",
    }),
  });
  assert.equal(resNoLower.status, 400);

  // Missing number
  const resNoNum = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "NoNumbersInPass",
    }),
  });
  assert.equal(resNoNum.status, 400);
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Reject reusing the current password
// ─────────────────────────────────────────────────────────────────────────────
test("13. PATCH /api/users/me/password - reject reusing current password with 400 Bad Request", async (t) => {
  const passwordHash = await bcrypt.hash("CurrentPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_charlie",
      name: "Charlie",
      email: "charlie@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_charlie" }, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "CurrentPassword123",
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /New password cannot be the same as the current password/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Verify new password works
// ─────────────────────────────────────────────────────────────────────────────
test("14. PATCH /api/users/me/password - verify new password works for subsequent login", async (t) => {
  const passwordHash = await bcrypt.hash("CurrentPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_david",
      name: "David",
      email: "david@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_david" }, TEST_SECRET);

  // Change password
  const changeRes = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "BrandNewPassword456!",
    }),
  });
  assert.equal(changeRes.status, 200);

  // Attempt login with new password
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "david@example.com",
      password: "BrandNewPassword456!",
    }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.equal(loginBody.success, true);
  assert.ok(loginBody.token);
  assert.equal(loginBody.user.email, "david@example.com");
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Verify old password no longer works
// ─────────────────────────────────────────────────────────────────────────────
test("15. PATCH /api/users/me/password - verify old password no longer works for login", async (t) => {
  const passwordHash = await bcrypt.hash("CurrentPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_david",
      name: "David",
      email: "david@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_david" }, TEST_SECRET);

  // Change password
  await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "CurrentPassword123",
      newPassword: "BrandNewPassword456!",
    }),
  });

  // Attempt login with OLD password
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "david@example.com",
      password: "CurrentPassword123",
    }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 401);
  assert.equal(loginBody.success, false);
  assert.match(loginBody.message, /Invalid email or password/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Verify password hash is never returned
// ─────────────────────────────────────────────────────────────────────────────
test("16. Security - verify passwordHash is never returned by any profile endpoint", async (t) => {
  const passwordHash = await bcrypt.hash("SecretPassword123", 10);
  const prisma = createMockPrisma([
    {
      id: "usr_eva",
      name: "Eva",
      email: "eva@example.com",
      passwordHash,
    },
  ]);
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken({ id: "usr_eva" }, TEST_SECRET);

  // 1. GET /api/users/me
  const getRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.user.passwordHash, undefined);
  assert.equal(getBody.passwordHash, undefined);
  assert.equal(JSON.stringify(getBody).includes("passwordHash"), false);

  // 2. PATCH /api/users/me
  const patchRes = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Eva Updated" }),
  });
  const patchBody = await patchRes.json();
  assert.equal(patchRes.status, 200);
  assert.equal(patchBody.user.passwordHash, undefined);
  assert.equal(patchBody.passwordHash, undefined);
  assert.equal(JSON.stringify(patchBody).includes("passwordHash"), false);

  // 3. PATCH /api/users/me/password
  const passRes = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "SecretPassword123",
      newPassword: "NewSecretPassword456",
    }),
  });
  const passBody = await passRes.json();
  assert.equal(passRes.status, 200);
  assert.equal(passBody.passwordHash, undefined);
  assert.equal(passBody.password, undefined);
  assert.equal(passBody.newPassword, undefined);
  assert.equal(passBody.currentPassword, undefined);
  assert.equal(JSON.stringify(passBody).includes("SecretPassword"), false);
});
