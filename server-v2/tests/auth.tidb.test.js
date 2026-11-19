const test = require("node:test");
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");
const { loadEnv } = require("../src/config/env");

test("TiDB Integration - Auth flow against TiDB Cloud (when reachable)", async (t) => {
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

  const testEmail = `tidb_test_${Date.now()}@cocode.internal`;

  t.after(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });
      await prisma.$disconnect();
    } catch {}
    await new Promise((resolve) => server.close(resolve));
  });

  // 1. Register test user
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "TiDB Integration User",
      email: testEmail,
      password: "TestPassword123!",
    }),
  });
  const regBody = await regRes.json();
  assert.equal(regRes.status, 201);
  assert.equal(regBody.success, true);
  assert.equal(regBody.user.email, testEmail);

  // 2. Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "TestPassword123!",
    }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.equal(loginBody.success, true);
  assert.ok(loginBody.token);

  // 3. Current User (/api/auth/me)
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  const meBody = await meRes.json();
  assert.equal(meRes.status, 200);
  assert.equal(meBody.success, true);
  assert.equal(meBody.user.email, testEmail);
  assert.equal(meBody.user.passwordHash, undefined);
});
