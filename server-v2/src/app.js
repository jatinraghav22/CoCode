const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

function createApp(config) {
  const app = express();

  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without an Origin header, such as health checks.
        if (!origin || config.clientOrigins.includes(origin)) {
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
