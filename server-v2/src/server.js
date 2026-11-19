const { loadEnv } = require("./config/env");
const { createApp } = require("./app");
const { prisma } = require("./config/prisma");

function startServer() {
  const config = loadEnv();
  const app = createApp(config, { prisma });

  const server = app.listen(config.port, () => {
    console.log(`CoCode Backend V2 running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health: http://localhost:${config.port}/api/health`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);

    server.close(async (error) => {
      try {
        await prisma.$disconnect();
      } catch (prismaErr) {
        console.error("Prisma disconnect error:", prismaErr.message);
      }

      if (error) {
        console.error("Shutdown error:", error);
        process.exitCode = 1;
        return;
      }

      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    console.error("Failed to start CoCode Backend V2:", error.message);
    process.exitCode = 1;
  }
}

module.exports = { startServer };
