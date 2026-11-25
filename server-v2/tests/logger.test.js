"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Logger, sanitizeValue } = require("../src/utils/logger");

test("Logger — sanitizes sensitive object properties", () => {
  const result = sanitizeValue({
    username: "developer",
    password: "hidden-password",
    accessToken: "hidden-access-token",
    refresh_token: "hidden-refresh-token",
    "api-key": "hidden-api-key",
    databaseUrl: "hidden-database-url",
    nested: {
      privateKey: "hidden-private-key",
      deep: {
        client_secret: "hidden-secret",
        normalKey: "safe-value",
      },
      sensitiveList: [
        "Bearer secret-jwt-token-12345",
        { passwordHash: "argon2id-hash-value" },
        "safe-entry",
      ],
    },
    errorInstance: new Error("Connection failed with database_url: mysql://admin:pass123@db:4000/main"),
  });

  assert.equal(result.username, "developer");
  assert.equal(result.password, "[REDACTED]");
  assert.equal(result.accessToken, "[REDACTED]");
  assert.equal(result.refresh_token, "[REDACTED]");
  assert.equal(result["api-key"], "[REDACTED]");
  assert.equal(result.databaseUrl, "[REDACTED]");
  assert.equal(result.nested.privateKey, "[REDACTED]");
  assert.equal(result.nested.deep.client_secret, "[REDACTED]");
  assert.equal(result.nested.deep.normalKey, "safe-value");
  assert.match(result.nested.sensitiveList[0], /Bearer \[REDACTED\]/);
  assert.equal(result.nested.sensitiveList[1].passwordHash, "[REDACTED]");
  assert.equal(result.nested.sensitiveList[2], "safe-entry");
  assert.equal(result.errorInstance.name, "Error");
  assert.doesNotMatch(result.errorInstance.message, /pass123/);
});

test("Logger — sanitizes bearer tokens and JSON strings with camelCase, snake_case, and hyphenated keys", () => {
  const jsonPayload = JSON.stringify({
    refreshToken: "secret-refresh-camel",
    refresh_token: "secret-refresh-snake",
    "api-key": "secret-api-key-hyphen",
    database_url: "mysql://user:pass@host:3306/db",
    private_key: "-----BEGIN PRIVATE KEY-----secret-----END PRIVATE KEY-----",
    client_secret: "secret-client-xyz",
    passwordHash: "argon2id$v=19$secretHash",
    service: "api",
    status: "ok",
    count: 42,
  });

  const rawMessage = `Authorization: Bearer test.token.signature Request body: ${jsonPayload}`;
  const sanitized = sanitizeValue(rawMessage);

  // Verify sensitive values are redacted across camelCase, snake_case, and hyphenated formats
  assert.match(sanitized, /Bearer \[REDACTED\]/);
  assert.doesNotMatch(sanitized, /test\.token\.signature/);
  assert.doesNotMatch(sanitized, /secret-refresh-camel/);
  assert.doesNotMatch(sanitized, /secret-refresh-snake/);
  assert.doesNotMatch(sanitized, /secret-api-key-hyphen/);
  assert.doesNotMatch(sanitized, /mysql:\/\/user:pass/);
  assert.doesNotMatch(sanitized, /BEGIN PRIVATE KEY/);
  assert.doesNotMatch(sanitized, /secret-client-xyz/);
  assert.doesNotMatch(sanitized, /secretHash/);

  // Verify non-sensitive operational fields are preserved intact
  assert.match(sanitized, /"service":\s*"api"/);
  assert.match(sanitized, /"status":\s*"ok"/);
  assert.match(sanitized, /"count":\s*42/);
});

test("Logger — request logs exclude query parameters", () => {
  const output = [];

  const logger = new Logger({
    isTest: false,
    outputFn: (message) => output.push(message),
    errorFn: (message) => output.push(message),
  });

  const req = {
    method: "GET",
    path: "/api/projects",
    originalUrl: "/api/projects?token=private-value",
    url: "/api/projects?token=private-value",
    ip: "127.0.0.1",
    headers: {},
  };

  let finishHandler;

  const res = {
    statusCode: 200,
    on(event, handler) {
      if (event === "finish") finishHandler = handler;
    },
  };

  logger.requestLogger()(req, res, () => { });
  finishHandler();

  assert.equal(output.length, 1);
  assert.match(output[0], /GET \/api\/projects 200/);
  assert.doesNotMatch(output[0], /private-value/);
  assert.doesNotMatch(output[0], /token=/);
});



test("Logger — sanitizes object messages", () => {
  const logger = new Logger({
    outputFn: () => { },
    errorFn: () => { },
  });

  const record = logger._format("ERROR", "TEST", {
    password: "hidden-password",
    message: "Database operation failed",
    nested: {
      accessToken: "hidden-token",
    },
  });

  assert.equal(record.message.password, "[REDACTED]");
  assert.equal(record.message.nested.accessToken, "[REDACTED]");
  assert.equal(record.message.message, "Database operation failed");
});

test("Logger — sanitizes Error messages", () => {
  const logger = new Logger({
    outputFn: () => { },
    errorFn: () => { },
  });

  const record = logger._format(
    "ERROR",
    "TEST",
    new Error('Request failed: {"password":"hidden-password"}')
  );

  assert.match(record.message, /Error:/);
  assert.doesNotMatch(record.message, /hidden-password/);
  assert.match(record.message, /\[REDACTED\]/);
});


