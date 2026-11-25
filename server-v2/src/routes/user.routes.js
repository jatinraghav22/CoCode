const { Router } = require("express");
const { createRateLimiter } = require("../middleware/rateLimiter");
const { createAuthMiddleware } = require("../middleware/auth");
const { UserService } = require("../modules/users/user.service");
const { UserController } = require("../modules/users/user.controller");

/**
 * Creates the user router with injected dependencies.
 *
 * @param {Object} options
 * @param {Object} options.config - Application config.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {Object} [options.userService] - Optional overridden UserService.
 * @param {Object} [options.authMiddleware] - Optional overridden requireAuth middleware.
 * @returns {Router} Express router.
 */
function createUserRouter(options) {
  const { config, prisma } = options;
  const router = Router();

  const isTest = (config && config.nodeEnv === "test") || process.env.NODE_ENV === "test";

  const passwordLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 15,
    message: "Too many password change attempts. Please try again after 15 minutes.",
    skip: () => isTest,
  });

  const userService =
    options.userService ||
    new UserService({
      prisma,
    });

  const userController = new UserController(userService);

  const requireAuth =
    options.authMiddleware ||
    createAuthMiddleware({
      jwtSecret: config.jwtSecret,
      prisma,
      jwtIssuer: config.jwtIssuer,
      jwtAudience: config.jwtAudience,
      userNotFoundStatus: 404,
      userNotFoundMessage: "User not found.",
    });

  router.get("/me", requireAuth, userController.getProfile);
  router.get("/profile", requireAuth, userController.getProfile);
  router.patch("/me", requireAuth, userController.updateProfile);
  router.put("/me", requireAuth, userController.updateProfile);
  router.patch("/profile", requireAuth, userController.updateProfile);
  router.put("/profile", requireAuth, userController.updateProfile);
  router.patch("/me/password", requireAuth, passwordLimiter, userController.changePassword);
  router.put("/me/password", requireAuth, passwordLimiter, userController.changePassword);

  return router;
}

module.exports = { createUserRouter };
