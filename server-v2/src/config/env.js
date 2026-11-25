const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

function loadEnv() {
  const port = Number(process.env.PORT || 5000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid port between 1 and 65535.");
  }

  const nodeEnv = process.env.NODE_ENV || "development";

  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, production, or test.");
  }

  const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Parse TRUST_PROXY configuration safely.
  // By default, false (no proxy trusted).
  // In production behind a reverse proxy (e.g., Render, AWS ALB, Cloudflare),
  // set TRUST_PROXY=1 (or specific subnet string like 'loopback').
  let trustProxy = false;
  if (process.env.TRUST_PROXY !== undefined && process.env.TRUST_PROXY !== "") {
    const rawVal = process.env.TRUST_PROXY.trim();
    if (rawVal.toLowerCase() === "false" || rawVal === "0") {
      trustProxy = false;
    } else if (rawVal.toLowerCase() === "true") {
      trustProxy = true;
    } else if (/^\d+$/.test(rawVal)) {
      trustProxy = parseInt(rawVal, 10);
    } else {
      trustProxy = rawVal;
    }
  }

  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (nodeEnv === "production") {
      throw new Error("JWT_SECRET environment variable is required in production.");
    }
    jwtSecret = "cocode_dev_jwt_secret_must_be_at_least_32_chars_long!";
  }

  if (typeof jwtSecret !== "string" || jwtSecret.trim().length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
  const jwtIssuer = process.env.JWT_ISSUER || "cocode-backend-v2";
  const jwtAudience = process.env.JWT_AUDIENCE || "cocode-client";

  const judge0BaseUrl = (process.env.JUDGE0_BASE_URL || "https://ce.judge0.com").replace(/\/+$/, "");
  const judge0ApiKey = process.env.JUDGE0_API_KEY || process.env.JUDGE0_AUTH_TOKEN || null;

  const rawTimeout = Number(process.env.JUDGE0_TIMEOUT_MS || 10000);
  const judge0TimeoutMs = Number.isFinite(rawTimeout) && rawTimeout >= 1000 && rawTimeout <= 60000 ? rawTimeout : 10000;

  const rawPollInterval = Number(process.env.JUDGE0_POLL_INTERVAL_MS || 750);
  const judge0PollIntervalMs = Number.isFinite(rawPollInterval) && rawPollInterval >= 100 && rawPollInterval <= 5000 ? rawPollInterval : 750;

  const rawMaxPoll = Number(process.env.JUDGE0_MAX_POLL_ATTEMPTS || 25);
  const judge0MaxPollAttempts = Number.isFinite(rawMaxPoll) && rawMaxPoll >= 1 && rawMaxPoll <= 60 ? rawMaxPoll : 25;

  const rawTotalTimeout = Number(process.env.JUDGE0_TOTAL_TIMEOUT_MS || 25000);
  const judge0TotalTimeoutMs = Number.isFinite(rawTotalTimeout) && rawTotalTimeout >= 3000 && rawTotalTimeout <= 60000 ? rawTotalTimeout : 25000;

  const judge0UseBase64 = process.env.JUDGE0_USE_BASE64 !== "false";

  return Object.freeze({
    nodeEnv,
    port,
    clientOrigins,
    trustProxy,
    jwtSecret,
    jwtExpiresIn,
    jwtIssuer,
    jwtAudience,
    judge0BaseUrl,
    judge0ApiKey,
    judge0TimeoutMs,
    judge0PollIntervalMs,
    judge0MaxPollAttempts,
    judge0TotalTimeoutMs,
    judge0UseBase64,
  });
}

module.exports = { loadEnv };
