"use strict";

/**
 * Room router — HTTP REST endpoints for room management.
 *
 * All routes require JWT authentication (via createAuthMiddleware).
 * User identity is derived from the verified JWT, never from the request body.
 *
 * Routes:
 *   POST /api/rooms        — Create a new room.
 *   POST /api/rooms/join   — Join an existing room by invite code.
 *   GET  /api/rooms/:code  — Get room info (members-only access).
 */

const { Router } = require("express");
const { createRateLimiter } = require("../middleware/rateLimiter");
const { createAuthMiddleware } = require("../middleware/auth");
const { RoomService } = require("../modules/rooms/room.service");
const { RoomController } = require("../modules/rooms/room.controller");

/**
 * @param {Object} options
 * @param {Object} options.config
 * @param {Object} options.prisma
 * @param {Object} [options.roomService]
 * @param {Object} [options.authMiddleware]
 * @returns {Router}
 */
function createRoomRouter(options) {
  const { config, prisma } = options;
  const router = Router();

  const isTest = (config && config.nodeEnv === "test") || process.env.NODE_ENV === "test";

  // Rate limit room creation: max 10 rooms per 15 minutes per IP
  const createRoomLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    message: "Too many room creation requests. Please try again later.",
    skip: () => isTest,
  });

  // Rate limit joining: max 30 attempts per 15 minutes per IP
  const joinRoomLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 30,
    message: "Too many room join attempts. Please try again later.",
    skip: () => isTest,
  });

  const requireAuth =
    options.authMiddleware ||
    createAuthMiddleware({
      jwtSecret: config.jwtSecret,
      prisma,
      jwtIssuer: config.jwtIssuer,
      jwtAudience: config.jwtAudience,
    });

  const roomService = options.roomService || new RoomService(prisma);
  const roomController = new RoomController(roomService);

  router.post("/", requireAuth, createRoomLimiter, roomController.createRoom);
  router.post("/join", requireAuth, joinRoomLimiter, roomController.joinRoom);
  router.get("/:code", requireAuth, roomController.getRoom);
  router.get("/:code/documents", requireAuth, roomController.getDocuments);

  return router;
}

module.exports = { createRoomRouter };
