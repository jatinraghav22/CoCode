const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const {
  signAccessToken,
  verifyAccessToken,
  extractBearerToken,
} = require("../src/utils/jwt");

const TEST_SECRET = "super_secret_test_key_at_least_32_characters_long!";

test("JWT Utility - signAccessToken generates valid JWT with sub claim", () => {
  const user = {
    id: "usr_123",
    name: "Ada Lovelace",
    email: "ada@example.com",
    passwordHash: "secret_hash_should_never_leak",
  };

  const token = signAccessToken(user, TEST_SECRET);
  assert.equal(typeof token, "string");

  const decoded = verifyAccessToken(token, TEST_SECRET);
  assert.equal(decoded.sub, "usr_123");
  assert.equal(decoded.name, "Ada Lovelace");
  assert.equal(decoded.email, "ada@example.com");
  assert.equal(decoded.iss, "cocode-backend-v2");
  assert.equal(decoded.aud, "cocode-client");

  // Ensure password and passwordHash are NEVER included in token
  assert.equal(decoded.password, undefined);
  assert.equal(decoded.passwordHash, undefined);
});

test("JWT Utility - signAccessToken throws if user.id or secret is missing", () => {
  assert.throws(
    () => signAccessToken({ name: "No ID" }, TEST_SECRET),
    /Cannot sign token without user.id/
  );
  assert.throws(
    () => signAccessToken({ id: "123" }, null),
    /A valid JWT secret is required to sign tokens/
  );
});

test("JWT Utility - verifyAccessToken detects expired tokens", () => {
  const user = { id: "usr_exp", name: "Expired User", email: "exp@example.com" };
  const expiredToken = signAccessToken(user, TEST_SECRET, { expiresIn: "-1s" });

  assert.throws(
    () => verifyAccessToken(expiredToken, TEST_SECRET),
    (err) => err.name === "TokenExpiredError"
  );
});

test("JWT Utility - verifyAccessToken rejects tokens signed with wrong secret", () => {
  const user = { id: "usr_wrong", name: "Wrong Secret", email: "wrong@example.com" };
  const token = signAccessToken(user, TEST_SECRET);
  const differentSecret = "completely_different_secret_key_32_chars_long!";

  assert.throws(
    () => verifyAccessToken(token, differentSecret),
    (err) => err.name === "JsonWebTokenError"
  );
});

test("JWT Utility - verifyAccessToken rejects tampered tokens", () => {
  const user = { id: "usr_tamper", name: "Tamper", email: "tamper@example.com" };
  const token = signAccessToken(user, TEST_SECRET);
  const tamperedToken = token.slice(0, -5) + "abcde";

  assert.throws(
    () => verifyAccessToken(tamperedToken, TEST_SECRET),
    (err) => err.name === "JsonWebTokenError"
  );
});

test("JWT Utility - extractBearerToken extracts token correctly", () => {
  assert.equal(extractBearerToken("Bearer eyJhbGciOi..."), "eyJhbGciOi...");
  assert.equal(extractBearerToken("bearer eyJhbGciOi..."), "eyJhbGciOi...");
  assert.equal(extractBearerToken("Bearer   token123  "), "token123");
  assert.equal(extractBearerToken(""), null);
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken("Basic abcdef"), null);
  assert.equal(extractBearerToken("InvalidHeaderValue"), null);
});
