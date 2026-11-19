const bcrypt = require("bcryptjs");

class NotFoundError extends Error {
  constructor(message = "User not found.") {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequestError";
    this.statusCode = 400;
  }
}

class UserService {
  constructor({ prisma }) {
    if (!prisma) {
      throw new Error("UserService requires a prisma client.");
    }
    this.prisma = prisma;
  }

  /**
   * Retrieves safe user profile by ID.
   *
   * @param {string} userId - Authenticated user ID.
   * @returns {Promise<Object>} Safe user profile without sensitive fields.
   */
  async getProfile(userId) {
    if (!userId) {
      throw new BadRequestError("User ID is required.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    return user;
  }

  /**
   * Updates authenticated user's profile (name only).
   *
   * @param {string} userId - Authenticated user ID.
   * @param {Object} data - { name: string }
   * @returns {Promise<Object>} Safe updated user profile.
   */
  async updateProfile(userId, { name }) {
    if (!userId) {
      throw new BadRequestError("User ID is required.");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError("User not found.");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Changes authenticated user's password.
   *
   * @param {string} userId - Authenticated user ID.
   * @param {Object} params - { currentPassword: string, newPassword: string }
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    if (!userId) {
      throw new BadRequestError("User ID is required.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const isCurrentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentMatch) {
      throw new BadRequestError("Incorrect current password.");
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      throw new BadRequestError("New password cannot be the same as the current password.");
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      success: true,
      message: "Password changed successfully.",
    };
  }
}

module.exports = {
  UserService,
  NotFoundError,
  BadRequestError,
};
