const { verifyAccessToken, extractBearerToken } = require("../utils/jwt");

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
      console.error("Auth middleware error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error during authentication.",
        error: "Internal server error during authentication.",
      });
    }
  };
}

module.exports = { createAuthMiddleware };
