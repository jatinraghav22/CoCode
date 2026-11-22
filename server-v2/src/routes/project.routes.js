"use strict";

const { Router } = require("express");
const { createRateLimiter } = require("../middleware/rateLimiter");
const { createAuthMiddleware } = require("../middleware/auth");
const { ProjectService } = require("../modules/projects/project.service");
const { ProjectController } = require("../modules/projects/project.controller");

/**
 * Creates the projects router with injected dependencies.
 *
 * @param {Object} options
 * @param {Object} options.config - Application config.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {Object} [options.projectService] - Optional overridden ProjectService.
 * @param {Object} [options.activityService] - Optional ActivityService instance.
 * @param {Object} [options.authMiddleware] - Optional overridden requireAuth middleware.
 * @returns {Router} Express router.
 */
function createProjectRouter(options) {
  const { config, prisma } = options;
  const router = Router();

  const isTest = (config && config.nodeEnv === "test") || process.env.NODE_ENV === "test";

  const createProjectLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 30,
    message: "Too many project creation requests. Please try again after 15 minutes.",
    keyGenerator: (req) => (req.userId ? `user_proj_${req.userId}` : req.ip || "127.0.0.1"),
    skip: () => isTest,
  });

  const saveAllLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 120,
    message: "Save rate limit exceeded. Please wait a moment before saving again.",
    keyGenerator: (req) => (req.userId ? `user_save_${req.userId}` : req.ip || "127.0.0.1"),
    skip: () => isTest,
  });

  const projectService =
    options.projectService ||
    new ProjectService(prisma, {
      activityService: options.activityService,
    });

  const projectController = new ProjectController(projectService);

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

  // Project CRUD
  router.post("/", requireAuth, createProjectLimiter, projectController.createProject);
  router.get("/", requireAuth, projectController.listProjects);
  router.get("/:id", requireAuth, projectController.getProject);
  router.put("/:id", requireAuth, projectController.updateProject);
  router.delete("/:id", requireAuth, projectController.deleteProject);

  // Project Files CRUD
  router.post("/:id/files", requireAuth, projectController.createProjectFile);
  router.get("/:id/files/:fileId", requireAuth, projectController.getProjectFile);
  router.put("/:id/files/:fileId", requireAuth, projectController.updateProjectFile);
  router.delete("/:id/files/:fileId", requireAuth, projectController.deleteProjectFile);

  // Phase 8: Folders, Search, and Batch Save
  router.post("/:id/folders", requireAuth, projectController.createFolder);
  router.put("/:id/folders", requireAuth, projectController.renameFolder);
  router.delete("/:id/folders", requireAuth, projectController.deleteFolder);
  router.get("/:id/search", requireAuth, projectController.searchProject);
  router.put("/:id/save-all", requireAuth, saveAllLimiter, projectController.saveAllFiles);

  return router;
}

module.exports = { createProjectRouter };
