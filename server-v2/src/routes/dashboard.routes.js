"use strict";

const { Router } = require("express");
const { createAuthMiddleware } = require("../middleware/auth");
const { DashboardService } = require("../modules/dashboard/dashboard.service");
const { DashboardController } = require("../modules/dashboard/dashboard.controller");

/**
 * Creates the dashboard router with injected dependencies.
 *
 * @param {Object} options
 * @param {Object} options.config - Application config.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {Object} [options.dashboardService] - Optional overridden DashboardService.
 * @param {Object} [options.authMiddleware] - Optional overridden requireAuth middleware.
 * @returns {Router} Express router.
 */
function createDashboardRouter(options) {
  const { config, prisma } = options;
  const router = Router();

  const dashboardService =
    options.dashboardService ||
    new DashboardService(prisma);

  const dashboardController = new DashboardController(dashboardService);

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

  router.get("/", requireAuth, dashboardController.getDashboard);

  return router;
}

module.exports = { createDashboardRouter };
