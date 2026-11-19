const {
  validateUpdateProfileInput,
  validateChangePasswordInput,
} = require("../../utils/validation");

class UserController {
  constructor(userService) {
    if (!userService) {
      throw new Error("UserController requires a userService instance.");
    }
    this.userService = userService;
  }

  getProfile = async (req, res, next) => {
    try {
      const user = await this.userService.getProfile(req.userId);
      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      if (error.statusCode === 404 || error.name === "NotFoundError") {
        return res.status(404).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }

      console.error("Get profile error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error while retrieving profile.",
        error: "Internal server error while retrieving profile.",
      });
    }
  };

  updateProfile = async (req, res, next) => {
    try {
      const validation = validateUpdateProfileInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          error: validation.error,
        });
      }

      const updatedUser = await this.userService.updateProfile(
        req.userId,
        validation.normalized
      );

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        user: updatedUser,
      });
    } catch (error) {
      if (error.statusCode === 404 || error.name === "NotFoundError") {
        return res.status(404).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }

      console.error("Update profile error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error while updating profile.",
        error: "Internal server error while updating profile.",
      });
    }
  };

  changePassword = async (req, res, next) => {
    try {
      const validation = validateChangePasswordInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          error: validation.error,
        });
      }

      const result = await this.userService.changePassword(
        req.userId,
        validation.normalized
      );

      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode === 400 || error.name === "BadRequestError") {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }

      if (error.statusCode === 404 || error.name === "NotFoundError") {
        return res.status(404).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }

      console.error("Change password error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error while changing password.",
        error: "Internal server error while changing password.",
      });
    }
  };
}

module.exports = { UserController };
