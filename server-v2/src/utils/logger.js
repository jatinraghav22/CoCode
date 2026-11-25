"use strict";

/**
 * Structured Production Logger for CoCode Backend V2.
 *
 * Features:
 * - Consistent format: ISO timestamp, log level, category, message, and safe metadata.
 * - Categories: HTTP, AUTH, COMPILER, SOCKET, DB, SHUTDOWN, SYSTEM.
 * - Strict sanitization: Automatically strips Bearer tokens, passwords, secrets,
 *   hashes, and private credentials from log messages, metadata, and JSON strings.
 * - Supports camelCase, snake_case, and hyphenated sensitive keys (e.g. refreshToken,
 *   refresh_token, api-key, database_url, private_key, client_secret, passwordHash).
 * - Preserves non-sensitive operational fields and strips query parameters.
 * - Non-intrusive in test environments: Suppresses verbose logs unless DEBUG=true or TEST_LOGS=true.
 *
 * Note: While this sanitizer strips common sensitive patterns and JSON key conventions
 * (camelCase, snake_case, kebab-case), it does not guarantee that every possible secret
 * format in arbitrary unstructured text will be detected.
 */

const SENSITIVE_KEY_REGEX = /^(password|passwordhash|currentpassword|newpassword|token|accesstoken|refreshtoken|jwtsecret|authorization|cookie|setcookie|apikey|clientsecret|secret|privatekey|databaseurl|connectionstring|sessionid)$/i;

function sanitizeValue(value, depth = 0) {
  if (depth > 5) return "[DEPTH_LIMIT]";
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeValue(value.message, depth + 1),
      ...(value.code ? { code: value.code } : {}),
    };
  }

  if (typeof value === "string") {
    let clean = value.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");

    // Strip database credentials embedded in connection URIs (e.g. mysql://user:pass@host)
    clean = clean.replace(/(?:mysql|postgresql|mongodb|postgres):\/\/([^:\s]+):([^@\s]+)@/gi, "$1:[REDACTED]@");

    // Match JSON string property pairs: "key": "value" or "key": value
    // Covers camelCase, snake_case, and hyphenated sensitive property names
    clean = clean.replace(/"([^"]+)"\s*:\s*("(?:\\.|[^"\\])*"|[^\s,}\]]+)/g, (match, key, rawVal) => {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (SENSITIVE_KEY_REGEX.test(normalizedKey)) {
        return `"${key}": "[REDACTED]"`;
      }
      return match;
    });

    // Match unquoted key: value or key=value patterns in plain text/logs
    clean = clean.replace(/(\b(?:password|passwordHash|currentPassword|newPassword|token|accessToken|refreshToken|refresh_token|apiKey|api-key|clientSecret|client_secret|jwtSecret|privateKey|private_key|databaseUrl|database_url)\b\s*[:=]\s*)("[^"]*"|\S+)/gi, '$1"[REDACTED]"');

    // Also redact raw passwordHash patterns if logged outside JSON
    clean = clean.replace(/(passwordHash\s*[:=]\s*)[^\s,]+/gi, '$1"[REDACTED]"');

    return clean;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      const normalizedKey = k.replace(/[^a-z0-9]/gi, "");
      if (SENSITIVE_KEY_REGEX.test(normalizedKey)) {
        sanitized[k] = "[REDACTED]";
      } else {
        sanitized[k] = sanitizeValue(v, depth + 1);
      }
    }
    return sanitized;
  }

  return value;
}

class Logger {
  constructor(options = {}) {
    this.isTest = options.isTest !== undefined
      ? Boolean(options.isTest)
      : (process.env.NODE_ENV === "test" && !process.env.TEST_LOGS);
    this.outputFn = options.outputFn || console.log;
    this.errorFn = options.errorFn || console.error;
  }

  _format(level, category, message, meta) {
    const timestamp = new Date().toISOString();

    let cleanMsg;

    if (message instanceof Error) {
      cleanMsg = `${message.name}: ${sanitizeValue(message.message)}`;
    } else {
      cleanMsg = sanitizeValue(message);
    }

    const cleanMeta = meta ? sanitizeValue(meta) : undefined;

    return {
      timestamp,
      level,
      category: category.toUpperCase(),
      message: cleanMsg,
      ...(cleanMeta ? { meta: cleanMeta } : {}),
    };
  }

  info(category, message, meta) {
    if (this.isTest) return;
    const record = this._format("INFO", category, message, meta);
    this.outputFn(`[${record.timestamp}] [INFO] [${record.category}] ${record.message}${meta ? " " + JSON.stringify(record.meta) : ""}`);
  }

  warn(category, message, meta) {
    if (this.isTest) return;
    const record = this._format("WARN", category, message, meta);
    this.outputFn(`[${record.timestamp}] [WARN] [${record.category}] ${record.message}${meta ? " " + JSON.stringify(record.meta) : ""}`);
  }

  error(category, message, meta) {
    const record = this._format("ERROR", category, message, meta);
    this.errorFn(`[${record.timestamp}] [ERROR] [${record.category}] ${record.message}${meta ? " " + JSON.stringify(record.meta) : ""}`);
  }

  /**
   * Express middleware for structured HTTP request logging.
   */
  requestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      const path = req.path || (req.originalUrl || req.url || "/").split("?")[0];

      res.on("finish", () => {
        // Skip spamming health/readiness check logs in tests
        if (this.isTest) return;
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;
        const method = req.method;
        const userAgent = (req.headers["user-agent"] || "-").slice(0, 100);
        const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";

        const logMsg = `${method} ${path} ${statusCode} - ${durationMs}ms [${ip}]`;
        if (statusCode >= 500) {
          this.error("HTTP", logMsg, { method, path, statusCode, durationMs });
        } else if (statusCode >= 400) {
          this.warn("HTTP", logMsg, { method, path, statusCode, durationMs });
        } else {
          // Liveness/readiness probes are logged at info
          this.info("HTTP", logMsg, { method, path, statusCode, durationMs });
        }
      });

      next();
    };
  }
}

const logger = new Logger();

module.exports = {
  Logger,
  logger,
  sanitizeValue,
};
