const test = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter } = require("../src/middleware/rateLimiter");

test("RateLimiter - enforces max requests limit and sets headers", () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 3,
    message: "Rate limit reached.",
    skip: () => false,
  });

  const req = {
    ip: "192.168.1.100",
    headers: {},
  };

  const headers = {};
  let statusCode = 200;
  let responseBody = null;

  const createRes = () => ({
    setHeader(name, val) {
      headers[name] = val;
    },
    status(code) {
      statusCode = code;
      return {
        json(body) {
          responseBody = body;
        },
      };
    },
  });

  let nextCalled = 0;
  const next = () => {
    nextCalled += 1;
  };

  // Request 1
  limiter(req, createRes(), next);
  assert.equal(nextCalled, 1);
  assert.equal(headers["RateLimit-Limit"], 3);
  assert.equal(headers["RateLimit-Remaining"], 2);

  // Request 2
  limiter(req, createRes(), next);
  assert.equal(nextCalled, 2);
  assert.equal(headers["RateLimit-Remaining"], 1);

  // Request 3
  limiter(req, createRes(), next);
  assert.equal(nextCalled, 3);
  assert.equal(headers["RateLimit-Remaining"], 0);

  // Request 4 (exceeds limit)
  limiter(req, createRes(), next);
  assert.equal(nextCalled, 3); // next should not be called
  assert.equal(statusCode, 429);
  assert.equal(responseBody.success, false);
  assert.equal(responseBody.message, "Rate limit reached.");
  assert.ok(headers["Retry-After"] > 0);
});
