const {
  validateRegisterInput,
  validateLoginInput,
} = require("../../utils/validation");
const { logger } = require("../../utils/logger");

class AuthController {
  constructor(authService) {
    if (!authService) {
      throw new Error("AuthController requires an authService instance.");
    }
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      const validation = validateRegisterInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          error: validation.error,
        });
      }

      const { user, token } = await this.authService.register(validation.normalized);

      return res.status(201).json({
        success: true,
        message: "User registered successfully.",
        token,
        user,
      });
    } catch (error) {
      if (error.statusCode === 409 || error.name === "ConflictError") {
        return res.status(409).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }

      // Handle Prisma unique constraint violation code (P2002) if encountered directly
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "An account with this email address already exists.",
          error: "An account with this email address already exists.",
        });
      }

      logger.error("AUTH", "Registration error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during registration.",
        error: "Internal server error during registration.",
      });
    }
  };

  login = async (req, res, next) => {
    try {
      const validation = validateLoginInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          error: validation.error,
        });
      }

      const result = await this.authService.login(validation.normalized);
      if (!result) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
          error: "Invalid email or password.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }
      if (typeof next === "function") {
        return next(error);
      }
      logger.error("AUTH", "Login error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during login.",
        error: "Internal server error during login.",
      });
    }
  };

  getMe = async (req, res) => {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  };

  logout = async (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully. Note that tokens are stateless; please clear the token from client storage.",
    });
  };
}

module.exports = { AuthController };
