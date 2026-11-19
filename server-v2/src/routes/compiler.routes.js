"use strict";

const { Router } = require("express");
const { createRateLimiter } = require("../middleware/rateLimiter");
const { createAuthMiddleware } = require("../middleware/auth");
const { CompilerService } = require("../modules/compiler/compiler.service");
const { Judge0Service } = require("../modules/compiler/judge0.service");
const { CompilerController } = require("../modules/compiler/compiler.controller");

/**
 * Creates the compiler router with injected dependencies.
 *
 * @param {Object} options
 * @param {Object} options.config - Application config.
 * @param {Object} options.prisma - PrismaClient instance.
 * @param {Object} [options.compilerService] - Optional overridden CompilerService.
 * @param {Object} [options.judge0Service] - Optional overridden Judge0Service.
 * @param {Object} [options.authMiddleware] - Optional overridden requireAuth middleware.
 * @param {Object} [options.rateLimiter] - Optional overridden compilerLimiter middleware.
 * @returns {Router} Express router.
 */
function createCompilerRouter(options = {}) {
  const { config, prisma } = options;
  const router = Router();

  const isTest = (config && config.nodeEnv === "test") || process.env.NODE_ENV === "test";

  const requireAuth =
    options.authMiddleware ||
    createAuthMiddleware({
      jwtSecret: config.jwtSecret,
      prisma,
      jwtIssuer: config.jwtIssuer,
      jwtAudience: config.jwtAudience,
      userNotFoundStatus: 401,
      userNotFoundMessage: "User account no longer exists.",
    });

  const compilerLimiter =
    options.rateLimiter ||
    createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: "Too many code execution requests. Please wait a moment before trying again.",
      keyGenerator: (req) => (req.userId ? `user_${req.userId}` : req.ip || "127.0.0.1"),
      skip: () => isTest,
    });

  const judge0Service =
    options.judge0Service ||
    new Judge0Service({
      baseUrl: config?.judge0BaseUrl,
      apiKey: config?.judge0ApiKey,
      timeoutMs: config?.judge0TimeoutMs,
      pollIntervalMs: config?.judge0PollIntervalMs,
      maxPollAttempts: config?.judge0MaxPollAttempts,
      useBase64: config?.judge0UseBase64,
    });

  const compilerService =
    options.compilerService ||
    new CompilerService({
      judge0Service,
    });

  const compilerController = new CompilerController(compilerService);

  router.get("/languages", requireAuth, compilerController.getLanguages);
  router.post("/run", requireAuth, compilerLimiter, compilerController.runCode);

  return router;
}

module.exports = { createCompilerRouter };
