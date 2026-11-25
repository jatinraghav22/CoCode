const { verifyAccessToken, extractBearerToken } = require("../utils/jwt");
const { logger } = require("../utils/logger");

/**
 * Creates authentication middleware with injected dependencies.
 *
 * @param {Object} options
 * @param {string} options.jwtSecret - The JWT signing secret.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {string} [options.jwtIssuer] - Expected JWT issuer.
 * @param {string} [options.jwtAudience] - Expected JWT audience.
 * @param {number} [options.userNotFoundStatus=401] - Status code when user is not found in database.
 * @param {string} [options.userNotFoundMessage="User account no longer exists."] - Message when user is not found.
 * @returns {Function} Express middleware function.
 */
function createAuthMiddleware({
  jwtSecret,
  prisma,
  jwtIssuer,
  jwtAudience,
  userNotFoundStatus = 401,
  userNotFoundMessage = "User account no longer exists.",
}) {
  if (!jwtSecret) {
    throw new Error("createAuthMiddleware requires jwtSecret.");
  }
  if (!prisma || !prisma.user) {
    throw new Error("createAuthMiddleware requires a valid prisma client with user model.");
  }

  return async function requireAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = extractBearerToken(authHeader);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Authentication token is required.",
          error: "Authentication token is required.",
        });
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
        });
      } catch (jwtErr) {
        if (jwtErr.name === "TokenExpiredError") {
          return res.status(401).json({
            success: false,
            message: "Token has expired.",
            error: "Token has expired.",
          });
        }

        return res.status(401).json({
          success: false,
          message: "Invalid authentication token.",
          error: "Invalid authentication token.",
        });
      }

      const userId = decoded.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Invalid token payload.",
          error: "Invalid token payload.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(userNotFoundStatus).json({
          success: false,
          message: userNotFoundMessage,
          error: userNotFoundMessage,
        });
      }

      // Attach safe authenticated user info (never includes passwordHash)
      req.user = user;
      req.userId = user.id;
      req.token = token;

      return next();
    } catch (error) {
      logger.error("AUTH", "Auth middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during authentication.",
        error: "Internal server error during authentication.",
      });
    }
  };
}

/**
 * Creates optional authentication middleware with injected dependencies.
 * - If NO Authorization header is provided: allows request through as guest (req.user = null, req.userId = null, req.token = null).
 * - If an Authorization header IS provided: strictly validates token signature, expiration, issuer, audience, and user existence.
 *   If the token is invalid, malformed, expired, or for a non-existent user, it rejects the request with 401.
 * - Guest requests are NEVER assigned a fake user ID or mock user account.
 *
 * @param {Object} options
 * @param {string} options.jwtSecret - The JWT signing secret.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {string} [options.jwtIssuer] - Expected JWT issuer.
 * @param {string} [options.jwtAudience] - Expected JWT audience.
 * @returns {Function} Express middleware function.
 */
function createOptionalAuthMiddleware({
  jwtSecret,
  prisma,
  jwtIssuer,
  jwtAudience,
}) {
  if (!jwtSecret) {
    throw new Error("createOptionalAuthMiddleware requires jwtSecret.");
  }
  if (!prisma || !prisma.user) {
    throw new Error("createOptionalAuthMiddleware requires a valid prisma client with user model.");
  }

  return async function optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = extractBearerToken(authHeader);

      // If no token / header was supplied, proceed as guest
      if (!token) {
        req.user = null;
        req.userId = null;
        req.token = null;
        return next();
      }

      // If token is supplied, it MUST be valid. Rejections are fail-closed.
      let decoded;
      try {
        decoded = verifyAccessToken(token, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
        });
      } catch (jwtErr) {
        if (jwtErr.name === "TokenExpiredError") {
          return res.status(401).json({
            success: false,
            message: "Token has expired.",
            error: "Token has expired.",
          });
        }

        return res.status(401).json({
          success: false,
          message: "Invalid authentication token.",
          error: "Invalid authentication token.",
        });
      }

      const userId = decoded.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Invalid token payload.",
          error: "Invalid token payload.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User account no longer exists.",
          error: "User account no longer exists.",
        });
      }

      req.user = user;
      req.userId = user.id;
      req.token = token;

      return next();
    } catch (error) {
      logger.error("AUTH", "Optional auth middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during authentication.",
        error: "Internal server error during authentication.",
      });
    }
  };
}

module.exports = { createAuthMiddleware, createOptionalAuthMiddleware };
