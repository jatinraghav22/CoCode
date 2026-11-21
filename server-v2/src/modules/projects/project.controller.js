"use strict";

class ProjectController {
  /**
   * @param {Object} projectService - ProjectService instance.
   */
  constructor(projectService) {
    if (!projectService) {
      throw new Error("ProjectController requires projectService.");
    }
    this.projectService = projectService;
  }

  createProject = async (req, res, next) => {
    try {
      const userId = req.userId;
      const project = await this.projectService.createProject(userId, req.body);
      return res.status(201).json({
        success: true,
        project,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  listProjects = async (req, res, next) => {
    try {
      const userId = req.userId;
      const result = await this.projectService.listProjects(userId, req.query);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  getProject = async (req, res, next) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const result = await this.projectService.getProject(userId, id);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  updateProject = async (req, res, next) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const result = await this.projectService.updateProject(userId, id, req.body);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  deleteProject = async (req, res, next) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const result = await this.projectService.deleteProject(userId, id);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  createProjectFile = async (req, res, next) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const result = await this.projectService.createProjectFile(userId, id, req.body);
      return res.status(201).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  getProjectFile = async (req, res, next) => {
    try {
      const userId = req.userId;
      const { id, fileId } = req.params;
      const result = await this.projectService.getProjectFile(userId, id, fileId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  updateProjectFile = async (req, res, next) => {
    try {
      const userId = req.userId;
      const { id, fileId } = req.params;
      const result = await this.projectService.updateProjectFile(userId, id, fileId, req.body);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };

  deleteProjectFile = async (req, res, next) => {
    try {
      const userId = req.userId;
      const { id, fileId } = req.params;
      const result = await this.projectService.deleteProjectFile(userId, id, fileId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          message: error.message,
        });
      }
      return next(error);
    }
  };
}

module.exports = { ProjectController };
