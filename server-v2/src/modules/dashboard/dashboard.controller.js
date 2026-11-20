"use strict";

class DashboardController {
  /**
   * @param {Object} dashboardService - DashboardService instance.
   */
  constructor(dashboardService) {
    if (!dashboardService) {
      throw new Error("DashboardController requires dashboardService.");
    }
    this.dashboardService = dashboardService;
  }

  getDashboard = async (req, res, next) => {
    try {
      const userId = req.userId;
      const data = await this.dashboardService.getDashboardData(userId);
      return res.status(200).json(data);
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

module.exports = { DashboardController };
