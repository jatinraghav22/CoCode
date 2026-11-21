"use strict";

class ActivityController {
  /**
   * @param {Object} activityService - ActivityService instance.
   */
  constructor(activityService) {
    if (!activityService) {
      throw new Error("ActivityController requires activityService.");
    }
    this.activityService = activityService;
  }

  getActivities = async (req, res, next) => {
    try {
      const userId = req.userId;
      const result = await this.activityService.getActivities(userId, req.query);
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

  getActivitySummary = async (req, res, next) => {
    try {
      const userId = req.userId;
      const result = await this.activityService.getActivitySummary(userId);
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

module.exports = { ActivityController };
