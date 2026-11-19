const bcrypt = require("bcryptjs");
const { signAccessToken } = require("../../utils/jwt");

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
  }
}

class AuthService {
  constructor({ prisma, jwtSecret, jwtExpiresIn, jwtIssuer, jwtAudience }) {
    if (!prisma) {
      throw new Error("AuthService requires a prisma client.");
    }
    if (!jwtSecret) {
      throw new Error("AuthService requires jwtSecret.");
    }

    this.prisma = prisma;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn || "7d";
    this.jwtIssuer = jwtIssuer || "cocode-backend-v2";
    this.jwtAudience = jwtAudience || "cocode-client";
  }

  /**
   * Registers a new user.
   *
   * @param {Object} data - { name, email, password }
   * @returns {Promise<{ user: Object, token: string }>}
   */
  async register({ name, email, password }) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictError("An account with this email address already exists.");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const token = signAccessToken(user, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
    });

    return { user, token };
  }

  /**
   * Authenticates user with email and password.
   *
   * @param {Object} credentials - { email, password }
   * @returns {Promise<{ user: Object, token: string }|null>}
   */
  async login({ email, password }) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const token = signAccessToken(safeUser, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
    });

    return { user: safeUser, token };
  }
}

module.exports = {
  AuthService,
  ConflictError,
};
