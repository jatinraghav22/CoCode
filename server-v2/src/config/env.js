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

  return Object.freeze({
    nodeEnv,
    port,
    clientOrigins,
    jwtSecret,
    jwtExpiresIn,
    jwtIssuer,
    jwtAudience,
  });
}

module.exports = { loadEnv };
