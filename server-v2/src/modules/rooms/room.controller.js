"use strict";

const { logger } = require("../../utils/logger");

/**
 * RoomController — handles HTTP REST endpoints for room management.
 *
 * POST /api/rooms       — Create a new room
 * POST /api/rooms/join  — Join an existing room by code
 * GET  /api/rooms/:code — Get room info (membership check)
 */

class RoomController {
  /**
   * @param {Object} roomService — RoomService instance.
   */
  constructor(roomService) {
    if (!roomService) throw new Error("RoomController requires a roomService.");
    this.roomService = roomService;
  }

  /**
   * POST /api/rooms
   * Creates a new collaboration room. Requires authentication.
   */
  createRoom = async (req, res) => {
    try {
      const { roomName, isPrivate } = req.body || {};
      const ownerId = req.userId; // Set by auth middleware — never from body

      if (!roomName || typeof roomName !== "string" || roomName.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Room name must be at least 3 characters.",
          error: "Room name must be at least 3 characters.",
        });
      }

      if (roomName.trim().length > 60) {
        return res.status(400).json({
          success: false,
          message: "Room name cannot exceed 60 characters.",
          error: "Room name cannot exceed 60 characters.",
        });
      }

      const { room } = await this.roomService.createRoom({
        ownerId,
        name: roomName.trim(),
        isPrivate: isPrivate !== false,
      });

      return res.status(201).json({
        success: true,
        message: "Room created successfully.",
        room,
      });
    } catch (error) {
      logger.error("ROOM", "Create room error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create room.",
        error: "Failed to create room.",
      });
    }
  };

  /**
   * POST /api/rooms/join
   * Joins an existing room by its 6-char invite code. Requires authentication.
   */
  joinRoom = async (req, res) => {
    try {
      const { roomCode } = req.body || {};
      const userId = req.userId; // Set by auth middleware

      if (!roomCode || typeof roomCode !== "string") {
        return res.status(400).json({
          success: false,
          message: "Room code is required.",
          error: "Room code is required.",
        });
      }

      const normalized = roomCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(normalized)) {
        return res.status(400).json({
          success: false,
          message: "Room code must be exactly 6 alphanumeric characters.",
          error: "Room code must be exactly 6 alphanumeric characters.",
        });
      }

      const { room, isNew } = await this.roomService.joinRoom({
        userId,
        roomCode: normalized,
      });

      return res.status(200).json({
        success: true,
        message: isNew ? "Joined room successfully." : "Room rejoined successfully.",
        room,
      });
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: "Room not found. Check the room code and try again.",
          error: "Room not found.",
        });
      }

      if (error.statusCode === 410) {
        return res.status(410).json({
          success: false,
          message: "This room has been closed.",
          error: "Room closed.",
        });
      }

      logger.error("ROOM", "Join room error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to join room.",
        error: "Failed to join room.",
      });
    }
  };

  /**
   * GET /api/rooms/:code
   * Returns room info for authenticated participants.
   */
  getRoom = async (req, res) => {
    try {
      const { code } = req.params;
      const userId = req.userId;

      if (!code || !/^[A-Z0-9]{6}$/i.test(code)) {
        return res.status(400).json({
          success: false,
          message: "Invalid room code.",
          error: "Invalid room code.",
        });
      }

      const room = await this.roomService.getRoomByCode(code.toUpperCase());

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found.",
          error: "Room not found.",
        });
      }

      // Confirm the requesting user is a participant
      const isMember = room.participants.some((p) => p.userId === userId);
      const isOwner = room.owner?.id === userId;

      if (!isMember && !isOwner) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this room.",
          error: "Access denied.",
        });
      }

      return res.status(200).json({
        success: true,
        room,
      });
    } catch (error) {
      logger.error("ROOM", "Get room error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch room.",
        error: "Failed to fetch room.",
      });
    }
  };

  /**
   * GET /api/rooms/:code/documents
   * Returns persistent documents for authenticated room participants.
   */
  getDocuments = async (req, res) => {
    try {
      const { code } = req.params;
      const userId = req.userId;

      if (!code || !/^[A-Z0-9]{6}$/i.test(code)) {
        return res.status(400).json({
          success: false,
          message: "Invalid room code.",
          error: "Invalid room code.",
        });
      }

      const isParticipant = await this.roomService.isParticipant(code, userId);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: "You are not an authorized participant in this room.",
          error: "Access denied.",
        });
      }

      const documents = await this.roomService.getRoomDocuments(code);
      return res.status(200).json({
        success: true,
        documents: (documents || []).map((d) => ({
          id: d.id,
          fileId: d.fileId,
          filename: d.filename,
          language: d.language,
          content: d.content,
          updatedAt: d.updatedAt,
        })),
      });
    } catch (error) {
      logger.error("ROOM", "Get room documents error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch room documents.",
        error: "Failed to fetch room documents.",
      });
    }
  };
}

module.exports = { RoomController };
