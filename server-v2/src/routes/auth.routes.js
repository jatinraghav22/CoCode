const { Router } = require("express");
const { createRateLimiter } = require("../middleware/rateLimiter");
const { createAuthMiddleware } = require("../middleware/auth");
const { AuthService } = require("../modules/auth/auth.service");
const { AuthController } = require("../modules/auth/auth.controller");

/**
 * Creates the auth router with injected dependencies.
 *
 * @param {Object} options
 * @param {Object} options.config - Application config.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {Object} [options.authService] - Optional overridden AuthService (for mocking/testing).
 * @param {Object} [options.authMiddleware] - Optional overridden requireAuth middleware.
 * @returns {Router} Express router.
 */
function createAuthRouter(options) {
  const { config, prisma } = options;
  const router = Router();

  const isTest = (config && config.nodeEnv === "test") || process.env.NODE_ENV === "test";

  const registerLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    message: "Too many registration attempts. Please try again after 15 minutes.",
    skip: () => isTest,
  });

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
    message: "Too many login attempts. Please try again after 15 minutes.",
    skip: () => isTest,
  });

  const authService =
    options.authService ||
    new AuthService({
      prisma,
      jwtSecret: config.jwtSecret,
      jwtExpiresIn: config.jwtExpiresIn,
      jwtIssuer: config.jwtIssuer,
      jwtAudience: config.jwtAudience,
    });

  const authController = new AuthController(authService);

  const requireAuth =
    options.authMiddleware ||
    createAuthMiddleware({
      jwtSecret: config.jwtSecret,
      prisma,
      jwtIssuer: config.jwtIssuer,
      jwtAudience: config.jwtAudience,
    });

  router.post("/register", registerLimiter, authController.register);
  router.post("/login", loginLimiter, authController.login);
  router.get("/me", requireAuth, authController.getMe);
  router.post("/logout", authController.logout);

  return router;
}

module.exports = { createAuthRouter };
