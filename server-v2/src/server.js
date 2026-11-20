const http = require("node:http");
const { loadEnv } = require("./config/env");
const { createApp } = require("./app");
const { prisma } = require("./config/prisma");
const { createSocketHandler } = require("./socket");
const { RoomService } = require("./modules/rooms/room.service");
const { roomStateStore } = require("./modules/rooms/room.store");

function startServer() {
  const config = loadEnv();
  const app = createApp(config, { prisma });

  // Create a plain HTTP server wrapping Express so Socket.IO can share it.
  const httpServer = http.createServer(app);

  // Attach Socket.IO collaboration layer and retain the io instance for shutdown
  const roomService = new RoomService(prisma);
  const io = createSocketHandler(httpServer, {
    jwtSecret: config.jwtSecret,
    jwtIssuer: config.jwtIssuer,
    jwtAudience: config.jwtAudience,
    clientOrigins: config.clientOrigins,
    prisma,
    roomService,
  });

  httpServer.listen(config.port, () => {
    console.log(`CoCode Backend V2 running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health: http://localhost:${config.port}/api/health`);
    console.log(`Socket.IO: enabled (real-time collaboration active)`);
  });

  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received. Shutting down gracefully...`);

    let closeFailed = false;
    let flushFailed = false;
    let disconnectFailed = false;

    // 1. Lock store to reject new collaboration writes immediately
    roomStateStore.setShuttingDown(true);

    // 2. Close Socket.IO — disconnects all active socket clients, closes the
    //    engine, and closes the attached httpServer (io.close() calls
    //    httpServer.close() internally in socket.io 4.x). Using io.close()
    //    as the single owner prevents a double-close race on the HTTP server.
    //    Bounded by a 10 s safety timer so shutdown never hangs indefinitely.
    //    The timer is always cleared once io.close() settles (success or error).
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("io.close() timed out after 10 s")),
          10000
        );
        try {
          io.close((err) => {
            clearTimeout(timer);
            err ? reject(err) : resolve();
          });
        } catch (syncErr) {
          clearTimeout(timer);
          reject(syncErr);
        }
      });
    } catch (closeErr) {
      closeFailed = true;
      console.error("Socket.IO/HTTP close error:", closeErr.message || closeErr);
    }

    // 3. Flush all pending room document saves with a bounded timeout
    try {
      const flushResult = await roomStateStore.flush(null, { timeoutMs: 5000 });
      if (!flushResult.success) {
        flushFailed = true;
        console.error("Shutdown flush completed with unsaved documents:", flushResult.unsaved);
      }
    } catch (flushErr) {
      flushFailed = true;
      console.error("Flush error during shutdown:", flushErr.message);
    }

    // 4. Disconnect Prisma only after flush attempt completes
    try {
      await prisma.$disconnect();
    } catch (prismaErr) {
      disconnectFailed = true;
      console.error("Prisma disconnect error:", prismaErr.message);
    }

    if (closeFailed || flushFailed || disconnectFailed) {
      process.exitCode = 1;
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return httpServer;
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
