const jwt = require("jsonwebtoken");

/**
 * Signs a JWT access token for the given user.
 *
 * @param {Object} user - User object containing at least id, name, and email.
 * @param {string} secret - JWT signing secret.
 * @param {Object} [options] - Additional jwt.sign options (expiresIn, issuer, audience).
 * @returns {string} Signed JWT.
 */
function signAccessToken(user, secret, options = {}) {
  if (!user || !user.id) {
    throw new Error("Cannot sign token without user.id");
  }
  if (!secret || typeof secret !== "string") {
    throw new Error("A valid JWT secret is required to sign tokens.");
  }

  // Construct payload with user id in standard `sub` claim.
  // Explicitly exclude passwords, hashes or other sensitive fields.
  const payload = {
    sub: String(user.id),
    name: user.name,
    email: user.email,
  };

  const signOptions = {
    expiresIn: options.expiresIn || "7d",
    issuer: options.issuer || "cocode-backend-v2",
    audience: options.audience || "cocode-client",
    ...options,
  };

  return jwt.sign(payload, secret, signOptions);
}

/**
 * Verifies a JWT access token.
 *
 * @param {string} token - The raw JWT string.
 * @param {string} secret - JWT signing secret.
 * @param {Object} [options] - Verification options (issuer, audience).
 * @returns {Object} Decoded payload.
 */
function verifyAccessToken(token, secret, options = {}) {
  if (!token || typeof token !== "string") {
    throw new Error("Token string is required for verification.");
  }
  if (!secret || typeof secret !== "string") {
    throw new Error("A valid JWT secret is required for verification.");
  }

  const verifyOptions = {
    issuer: options.issuer || "cocode-backend-v2",
    audience: options.audience || "cocode-client",
    ...options,
  };

  return jwt.verify(token, secret, verifyOptions);
}

/**
 * Extracts a Bearer token from an Authorization header value.
 *
 * @param {string} [authHeader] - Header string like "Bearer <token>".
 * @returns {string|null} Extracted token or null if not valid Bearer format.
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  extractBearerToken,
};
