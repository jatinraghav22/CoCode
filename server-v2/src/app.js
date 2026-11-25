const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { prisma: defaultPrisma } = require("./config/prisma");
const { createAuthRouter } = require("./routes/auth.routes");
const { createUserRouter } = require("./routes/user.routes");
const { createCompilerRouter } = require("./routes/compiler.routes");
const { createRoomRouter } = require("./routes/room.routes");
const { createDashboardRouter } = require("./routes/dashboard.routes");
const { createProjectRouter } = require("./routes/project.routes");
const { createActivityRouter } = require("./routes/activity.routes");
const { ActivityService } = require("./modules/activity/activity.service");
const { ProjectService } = require("./modules/projects/project.service");
const { logger } = require("./utils/logger");

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
  if (resolvedConfig.trustProxy !== undefined && resolvedConfig.trustProxy !== false) {
    app.set("trust proxy", resolvedConfig.trustProxy);
  } else {
    app.set("trust proxy", false);
  }

  app.use(helmet());
  app.use(logger.requestLogger());

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

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  // Liveness probe — fast check confirming server process is running
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      success: true,
      service: "cocode-backend-v2",
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Readiness probe — deep check confirming critical dependencies (TiDB database) are operational
  app.get("/api/ready", async (req, res) => {
    if (!prisma || typeof prisma.$queryRaw !== "function") {
      return res.status(503).json({
        success: false,
        service: "cocode-backend-v2",
        status: "not_ready",
        checks: {
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      });
    }

    let timeoutHandle = null;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error("Database readiness probe timed out")),
          4000
        );
      });

      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        timeoutPromise,
      ]);

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      return res.status(200).json({
        success: true,
        service: "cocode-backend-v2",
        status: "ready",
        checks: {
          database: "healthy",
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      return res.status(503).json({
        success: false,
        service: "cocode-backend-v2",
        status: "not_ready",
        checks: {
          database: "unreachable",
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  const authRouter = createAuthRouter({
    config: resolvedConfig,
    prisma,
    authService: dependencies.authService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/auth", authRouter);

  const userRouter = createUserRouter({
    config: resolvedConfig,
    prisma,
    userService: dependencies.userService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/users", userRouter);
  app.use("/api/user", userRouter);

  const activityService =
    dependencies.activityService || new ActivityService(prisma);

  const compilerRouter = createCompilerRouter({
    config: resolvedConfig,
    prisma,
    compilerService: dependencies.compilerService,
    judge0Service: dependencies.judge0Service,
    activityService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/compiler", compilerRouter);

  const roomRouter = createRoomRouter({
    config: resolvedConfig,
    prisma,
    roomService: dependencies.roomService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/rooms", roomRouter);

  const projectRouter = createProjectRouter({
    config: resolvedConfig,
    prisma,
    projectService: dependencies.projectService,
    activityService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/projects", projectRouter);

  const activityRouter = createActivityRouter({
    config: resolvedConfig,
    prisma,
    activityService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/activity", activityRouter);

  const dashboardRouter = createDashboardRouter({
    config: resolvedConfig,
    prisma,
    dashboardService: dependencies.dashboardService,
    authMiddleware: dependencies.authMiddleware,
  });

  app.use("/api/dashboard", dashboardRouter);

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
        error: "Forbidden by CORS policy.",
        message: err.message,
      });
    }

    // Malformed JSON request body
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({
        success: false,
        error: "Malformed JSON payload in request.",
        message: "Malformed JSON payload in request.",
      });
    }

    // Payload too large (body-parser limit exceeded)
    if (err.type === "entity.too.large" || err.status === 413) {
      return res.status(413).json({
        success: false,
        error: "Payload exceeds maximum allowed size.",
        message: "Payload exceeds maximum allowed size.",
      });
    }

    // Prisma: Unique constraint violation
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "field";
      return res.status(409).json({
        success: false,
        error: `A record with this ${target} already exists.`,
        message: `A record with this ${target} already exists.`,
      });
    }

    // Prisma: Record not found
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Requested record was not found.",
        message: "Requested record was not found.",
      });
    }

    // Prisma: Foreign key constraint failed
    if (err.code === "P2003") {
      return res.status(400).json({
        success: false,
        error: "Invalid relation or referenced record does not exist.",
        message: "Invalid relation or referenced record does not exist.",
      });
    }

    // Prisma: Database connection failure / initialization error
    if (err.name === "PrismaClientInitializationError" || err.code === "P2024") {
      logger.error("DB", "Database service unreachable", {
        errorName: err.name,
        errorCode: err.code,
      });
      return res.status(503).json({
        success: false,
        error: "Database service is currently unreachable.",
        message: "Database service is currently unreachable.",
      });
    }

    const statusCode = Number(err.status || err.statusCode) || 500;

    // Log safe diagnostic metadata only; never log raw exception messages.
    if (statusCode >= 500) {
      logger.error("HTTP", `Unhandled server error [${statusCode}]`, {
        errorName: err.name,
        errorCode: err.code,
        statusCode,
      });
    }

    // Only expose client-facing message for known 4xx client errors, never for 5xx internal failures
    if (statusCode >= 400 && statusCode < 500 && err.message) {
      return res.status(statusCode).json({
        success: false,
        error: err.message,
        message: err.message,
      });
    }

    return res.status(statusCode >= 400 && statusCode <= 599 ? statusCode : 500).json({
      success: false,
      error: "Internal server error.",
      message: "Internal server error.",
    });
  });

  return app;
}

module.exports = { createApp };
