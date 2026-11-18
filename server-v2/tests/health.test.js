const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

const config = {
  nodeEnv: "test",
  port: 0,
  clientOrigins: ["http://localhost:5173"],
};

test("GET /api/health returns a healthy response", async (t) => {
  const app = createApp(config);
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.service, "cocode-backend-v2");
  assert.equal(body.status, "healthy");
  assert.equal(typeof body.timestamp, "string");
  assert.equal(typeof body.uptime, "number");
});

test("Unknown API routes return 404", async (t) => {
  const app = createApp(config);
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/unknown`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
});
