const http = require("node:http");
const { loadEnv } = require("./config/env");
const { createApp } = require("./app");
const { prisma } = require("./config/prisma");
const { createSocketHandler } = require("./socket");
const { RoomService } = require("./modules/rooms/room.service");
const { roomStateStore } = require("./modules/rooms/room.store");

/**
 * Overall shutdown deadline in milliseconds.
 * This bounds the total time the process may spend on graceful shutdown
 * (Socket.IO close + room flush + Prisma disconnect) before force-exiting.
 * Must be shorter than the deployment platform's SIGTERM grace period
 * (typically 30 s on standard container platforms, 30 s on Kubernetes default, etc.).
 */
const SHUTDOWN_DEADLINE_MS = 20000;

/**
 * Creates a coordinated graceful shutdown handler with a shared in-progress promise.
 *
 * Requirements:
 *   - Every caller of `shutdown()` receives the SAME in-progress promise.
 *   - If an unhandled rejection or uncaught exception occurs during SIGTERM shutdown,
 *     it marks failure exit code without terminating before the shutdown finishes.
 *   - Overall 20-second deadline and force-exit safety net.
 *   - Socket.IO close -> Room flush -> Prisma disconnect ordering.
 *   - Force-exit timer is cleared after successful shutdown.
 *   - Nonzero exit status on failure.
 *   - Sanitizes sensitive information in logs.
 *
 * @param {Object} deps
 * @param {Object} [deps.io]
 * @param {Object} [deps.roomStateStore]
 * @param {Object} [deps.prisma]
 * @param {Object} [deps.options]
 * @param {number} [deps.options.shutdownDeadlineMs=20000]
 * @param {Function} [deps.options.exitFn=process.exit]
 * @param {Function} [deps.options.setExitCodeFn]
 * @param {Function} [deps.options.logFn=console.log]
 * @param {Function} [deps.options.errorFn=console.error]
 * @param {boolean} [deps.options.autoExit=true]
 * @param {boolean} [deps.options.unrefTimers=false]
 * @returns {{ shutdown: Function, getSharedPromise: Function, getExitCode: Function }}
 */
function createShutdownHandler({
  io = null,
  roomStateStore = null,
  prisma = null,
  options = {},
} = {}) {
  const deadlineMs = options.shutdownDeadlineMs || SHUTDOWN_DEADLINE_MS;
  const exitFn = options.exitFn || ((code) => process.exit(code));
  const setExitCode = options.setExitCodeFn || ((code) => { process.exitCode = code; });
  const log = options.logFn || console.log;
  const error = options.errorFn || console.error;
  const autoExit = options.autoExit !== false;

  let shutdownPromise = null;
  let forceExitTimer = null;
  let finalExitCode = 0;

  const markFailure = () => {
    finalExitCode = 1;
    setExitCode(1);
  };

  const shutdown = (signal, details = {}) => {
    // If an unhandled rejection or uncaught exception occurs, set failure exit code
    if (details.isFatal || signal === "uncaughtException" || signal === "unhandledRejection") {
      markFailure();
    }

    // Return the existing in-progress promise if shutdown already started
    if (shutdownPromise) {
      return shutdownPromise;
    }

    const shutdownStart = Date.now();
    log(`${signal} received. Shutting down gracefully (deadline: ${deadlineMs}ms)...`);

    // Force-exit safety net: if the entire sequence stalls, terminate.
    const forceExitPromise = new Promise((resolve) => {
      forceExitTimer = setTimeout(() => {
        error(`FATAL: Shutdown deadline of ${deadlineMs}ms exceeded. Persistence could not be confirmed. Force-terminating.`);
        markFailure();
        resolve({ type: "FORCE_EXIT" });
      }, deadlineMs);
      if (options.unrefTimers && typeof forceExitTimer.unref === "function") {
        forceExitTimer.unref();
      }
    });

    const doShutdown = async () => {
      let closeFailed = false;
      let flushFailed = false;
      let disconnectFailed = false;

      // 1. Lock room store to reject new collaboration writes immediately
      try {
        if (roomStateStore && typeof roomStateStore.setShuttingDown === "function") {
          roomStateStore.setShuttingDown(true);
        }
      } catch (err) {
        error("Error locking roomStateStore:", err.message);
      }

      // 2. Close Socket.IO + HTTP server
      const remainingForClose = (shutdownStart + deadlineMs) - Date.now();
      const ioCloseTimeout = Math.min(10000, Math.max(1000, remainingForClose - 2000));
      try {
        if (io && typeof io.close === "function") {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`io.close() timed out after ${ioCloseTimeout} ms`)),
              ioCloseTimeout
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
        }
      } catch (closeErr) {
        closeFailed = true;
        markFailure();
        error("Socket.IO/HTTP close error:", closeErr.message || closeErr);
      }

      // 3. Flush all pending room document saves
      let flushTimedOut = false;
      const remainingForFlush = (shutdownStart + deadlineMs) - Date.now();
      const flushBudget = Math.max(500, remainingForFlush - 1000);
      try {
        if (roomStateStore && typeof roomStateStore.flush === "function") {
          const flushResult = await roomStateStore.flush(null, { timeoutMs: flushBudget });
          if (flushResult && flushResult.timedOut) {
            flushTimedOut = true;
          }
          if (!flushResult.success) {
            flushFailed = true;
            markFailure();
            const detailsList = (flushResult.unsaved || [])
              .map((u) => `[${u.type || "target"}:${u.roomCode}${u.fileId ? ` file:${u.fileId}` : ""} error:${u.error}]`)
              .join(", ");
            error(`Shutdown flush completed with unsaved documents: ${detailsList}`);
            if (flushResult.timedOut) {
              error("WARNING: Flush timed out. Pending database operations may still be in flight; skipping premature Prisma disconnect to allow in-flight operations to settle.");
            }
          }
        }
      } catch (flushErr) {
        flushFailed = true;
        markFailure();
        error("Flush error during shutdown:", flushErr.message);
      }

      // 4. Disconnect Prisma client only if flush did NOT time out.
      // If flush timed out, outstanding hydration or save operations may still be running
      // against Prisma. Prematurely disconnecting Prisma would cause them to fail immediately.
      // If flush completed (with success, or with completed save errors without timing out),
      // Prisma is disconnected normally.
      if (!flushTimedOut) {
        try {
          if (prisma && typeof prisma.$disconnect === "function") {
            await prisma.$disconnect();
          }
        } catch (prismaErr) {
          disconnectFailed = true;
          markFailure();
          error("Prisma disconnect error:", prismaErr.message);
        }
      }

      return { type: "COMPLETED", closeFailed, flushFailed, flushTimedOut, disconnectFailed };
    };

    shutdownPromise = (async () => {
      try {
        const outcome = await Promise.race([
          doShutdown(),
          forceExitPromise,
        ]);

        if (forceExitTimer) {
          clearTimeout(forceExitTimer);
          forceExitTimer = null;
        }

        if (outcome.type === "FORCE_EXIT") {
          markFailure();
          if (autoExit) exitFn(1);
          return { success: false, exitCode: 1, forced: true };
        }

        const isSuccess = !outcome.closeFailed && !outcome.flushFailed && !outcome.disconnectFailed && finalExitCode === 0;
        const code = isSuccess ? 0 : 1;
        setExitCode(code);

        if (autoExit) {
          exitFn(code);
        }

        return { success: isSuccess, exitCode: code, forced: false };
      } catch (fatalErr) {
        if (forceExitTimer) {
          clearTimeout(forceExitTimer);
          forceExitTimer = null;
        }
        markFailure();
        error("Unexpected fatal error during shutdown:", fatalErr.message);
        if (autoExit) exitFn(1);
        return { success: false, exitCode: 1, forced: false, error: fatalErr };
      }
    })();

    return shutdownPromise;
  };

  return {
    shutdown,
    getSharedPromise: () => shutdownPromise,
    getExitCode: () => finalExitCode,
  };
}

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

  const { shutdown } = createShutdownHandler({
    io,
    roomStateStore,
    prisma,
  });

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    console.error("FATAL: Uncaught exception in server process:", err.message);
    shutdown("uncaughtException", { isFatal: true });
  });
  process.on("unhandledRejection", (reason) => {
    // Log safely: reason may be an Error or a primitive.
    const message = reason instanceof Error ? reason.message : String(reason ?? "unknown");
    const safeMessage = message
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .replace(/"password":\s*"[^"]+"/gi, '"password": "[REDACTED]"');
    console.error("FATAL: Unhandled promise rejection:", safeMessage);
    shutdown("unhandledRejection", { isFatal: true });
  });

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

module.exports = { startServer, createShutdownHandler, SHUTDOWN_DEADLINE_MS };
