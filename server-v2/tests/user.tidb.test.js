const test = require("node:test");
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");
const { loadEnv } = require("../src/config/env");

test("TiDB Integration - User profile & account management against TiDB Cloud (when reachable)", async (t) => {
  let prisma;
  try {
    prisma = new PrismaClient({ log: ["error"] });
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    t.skip(`Skipping TiDB integration test: TiDB is unreachable in current environment (${err.message.split("\n")[0]})`);
    return;
  }

  const config = loadEnv();
  const app = createApp(config, { prisma });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const testEmail = `tidb_profile_test_${Date.now()}@cocode.internal`;
  let authToken = null;

  t.after(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });
      await prisma.$disconnect();
    } catch {}
    await new Promise((resolve) => server.close(resolve));
  });

  // 1. Register test user to obtain JWT
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Initial TiDB User",
      email: testEmail,
      password: "InitialPassword123!",
    }),
  });
  const regBody = await regRes.json();
  assert.equal(regRes.status, 201);
  assert.equal(regBody.success, true);
  authToken = regBody.token;

  // 2. GET /api/users/me
  const getRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const getBody = await getRes.json();
  assert.equal(getRes.status, 200);
  assert.equal(getBody.success, true);
  assert.equal(getBody.user.name, "Initial TiDB User");
  assert.equal(getBody.user.email, testEmail);
  assert.equal(getBody.user.passwordHash, undefined);

  // 3. PATCH /api/users/me (update name)
  const patchRes = await fetch(`${baseUrl}/api/users/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Updated TiDB User",
    }),
  });
  const patchBody = await patchRes.json();
  assert.equal(patchRes.status, 200);
  assert.equal(patchBody.success, true);
  assert.equal(patchBody.user.name, "Updated TiDB User");

  // Verify in GET /api/users/me
  const getUpdatedRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const getUpdatedBody = await getUpdatedRes.json();
  assert.equal(getUpdatedBody.user.name, "Updated TiDB User");

  // 4. PATCH /api/users/me/password (change password)
  const passRes = await fetch(`${baseUrl}/api/users/me/password`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword: "InitialPassword123!",
      newPassword: "BrandNewPassword789!",
    }),
  });
  const passBody = await passRes.json();
  assert.equal(passRes.status, 200);
  assert.equal(passBody.success, true);
  assert.equal(passBody.message, "Password changed successfully.");

  // 5. Verify old password fails login
  const failLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "InitialPassword123!",
    }),
  });
  assert.equal(failLogin.status, 401);

  // 6. Verify new password succeeds login
  const successLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "BrandNewPassword789!",
    }),
  });
  const successBody = await successLogin.json();
  assert.equal(successLogin.status, 200);
  assert.ok(successBody.token);
});
