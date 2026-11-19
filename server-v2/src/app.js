const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { prisma: defaultPrisma } = require("./config/prisma");
const { createAuthRouter } = require("./routes/auth.routes");

function createApp(config, dependencies = {}) {
  const app = express();

  const resolvedConfig = {
    jwtSecret: "cocode_dev_jwt_secret_must_be_at_least_32_chars_long!",
    jwtExpiresIn: "7d",
    jwtIssuer: "cocode-backend-v2",
    jwtAudience: "cocode-client",
    ...config,
  };

  const prisma = dependencies.prisma || defaultPrisma;

  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without an Origin header, such as health checks.
        if (!origin || (resolvedConfig.clientOrigins && resolvedConfig.clientOrigins.includes(origin))) {
          return callback(null, true);
        }

        return callback(new Error("Origin is not allowed by CORS."));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.status(200).json({
      success: true,
      service: "cocode-backend-v2",
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  const authRouter = createAuthRouter({
    config: resolvedConfig,
    prisma,
    authService: dependencies.authService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/auth", authRouter);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "API route not found.",
    });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err.message === "Origin is not allowed by CORS.") {
      return res.status(403).json({
        success: false,
        message: err.message,
      });
    }

    console.error("Unhandled application error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  });

  return app;
}

module.exports = { createApp };
