/**
 * In-memory rate limiter middleware.
 * Tracks requests per IP address within a configurable sliding window.
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
  const maxRequests = options.maxRequests || 100;
  const message =
    options.message ||
    "Too many requests from this IP address. Please try again later.";
  const skip = typeof options.skip === "function" ? options.skip : () => false;

  const hits = new Map();

  // Periodically clean up stale entries (unref so timer does not block Node exit)
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, Math.min(windowMs, 60000));

  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }

  function rateLimiterMiddleware(req, res, next) {
    if (skip(req)) {
      return next();
    }

    const ip =
      req.ip ||
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const now = Date.now();
    let record = hits.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", maxRequests);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        error: message,
        retryAfter: retryAfterSeconds,
      });
    }

    return next();
  }

  // Method to reset hit counts (useful for testing)
  rateLimiterMiddleware.reset = () => {
    hits.clear();
  };

  return rateLimiterMiddleware;
}

module.exports = { createRateLimiter };
