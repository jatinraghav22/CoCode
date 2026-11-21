"use strict";

const { Router } = require("express");
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
  router.post("/", requireAuth, projectController.createProject);
  router.get("/", requireAuth, projectController.listProjects);
  router.get("/:id", requireAuth, projectController.getProject);
  router.put("/:id", requireAuth, projectController.updateProject);
  router.delete("/:id", requireAuth, projectController.deleteProject);

  // Project Files CRUD
  router.post("/:id/files", requireAuth, projectController.createProjectFile);
  router.get("/:id/files/:fileId", requireAuth, projectController.getProjectFile);
  router.put("/:id/files/:fileId", requireAuth, projectController.updateProjectFile);
  router.delete("/:id/files/:fileId", requireAuth, projectController.deleteProjectFile);

  return router;
}

module.exports = { createProjectRouter };
