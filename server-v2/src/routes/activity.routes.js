"use strict";

const { Router } = require("express");
const { createAuthMiddleware } = require("../middleware/auth");
const { ActivityService } = require("../modules/activity/activity.service");
const { ActivityController } = require("../modules/activity/activity.controller");

/**
 * Creates the activity router with injected dependencies.
 *
 * @param {Object} options
 * @param {Object} options.config - Application config.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {Object} [options.activityService] - Optional overridden ActivityService.
 * @param {Object} [options.authMiddleware] - Optional overridden requireAuth middleware.
 * @returns {Router} Express router.
 */
function createActivityRouter(options) {
  const { config, prisma } = options;
  const router = Router();

  const activityService =
    options.activityService ||
    new ActivityService(prisma);

  const activityController = new ActivityController(activityService);

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

  router.get("/", requireAuth, activityController.getActivities);
  router.get("/summary", requireAuth, activityController.getActivitySummary);

  return router;
}

module.exports = { createActivityRouter };
