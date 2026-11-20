"use strict";

/**
 * createSocketHandler — attaches Socket.IO collaboration logic to an http.Server.
 *
 * Production Features:
 * - JWT Authentication: Verifies token, signature, issuer, and audience on handshake.
 * - Persistent Room Authorization: Validates DB enrollment via TiDB before admission.
 * - Yjs CRDT Synchronization: Receives incremental updates (`yjs:update`), applies to
 *   server Y.Doc, merges concurrent edits, and broadcasts to peers.
 * - TiDB Cloud Persistence: Documents are stored in `room_documents` and re-hydrated
 *   automatically on backend restarts.
 * - Canonical & Legacy Code Sync: Supports `yjs:update` (primary CRDT) and `code:update`
 *   (canonical text sync) with single-channel deduplication and echo prevention.
 * - Multi-Tab Presence: Accurate tracking per user so closing one tab doesn't drop presence.
 * - Room Switching: Gracefully leaves current room before joining a new room.
 * - Input & Size Validation: Enforces strict payload limits on code (200 KB) and updates (500 KB).
 */

const { Server } = require("socket.io");
const { verifyAccessToken } = require("./utils/jwt");
const { roomStateStore } = require("./modules/rooms/room.store");

/** Maximum allowed plain text code payload: 200 KB. */
const MAX_CODE_BYTES = 200 * 1024;

/** Maximum allowed binary Yjs update payload: 500 KB. */
const MAX_UPDATE_BYTES = 500 * 1024;

/** Maximum allowed chat message length. */
const MAX_CHAT_LENGTH = 2000;

/**
 * Attaches Socket.IO to the existing http.Server and wires up all
 * collaboration event handlers.
 *
 * @param {import("http").Server} httpServer
 * @param {Object} options
 * @param {string}   options.jwtSecret
 * @param {string}   options.jwtIssuer
 * @param {string}   options.jwtAudience
 * @param {string[]} options.clientOrigins
 * @param {Object}   options.prisma       - PrismaClient instance.
 * @param {Object}   options.roomService  - RoomService instance.
 * @returns {import("socket.io").Server}
 */
function createSocketHandler(httpServer, options) {
  const { jwtSecret, jwtIssuer, jwtAudience, clientOrigins, roomService } = options;

  if (!jwtSecret) throw new Error("createSocketHandler requires jwtSecret.");
  if (!roomService) throw new Error("createSocketHandler requires roomService.");

  // Wire RoomService to the store for persistent TiDB synchronization
  roomStateStore.setRoomService(roomService);

  // ─── Create Socket.IO server ───────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || (clientOrigins && clientOrigins.includes(origin))) {
          return callback(null, true);
        }
        return callback(new Error("Socket.IO: Origin not allowed."), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    maxHttpBufferSize: 600 * 1024, // 600 KB buffer
    pingTimeout: 20000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
  });

  // ─── Authentication middleware ─────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();

      if (!token) {
        return next(new Error("Authentication token is required."));
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
        });
      } catch (jwtErr) {
        if (jwtErr.name === "TokenExpiredError") {
          return next(new Error("Authentication token has expired."));
        }
        return next(new Error("Invalid authentication token."));
      }

      const userId = decoded.sub;
      if (!userId) {
        return next(new Error("Invalid token payload."));
      }

      // Verify user still exists in TiDB
      const user = await options.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      });

      if (!user) {
        return next(new Error("User account no longer exists."));
      }

      // Attach verified identity to the socket — never trust client claims
      socket.userId = user.id;
      socket.userName = user.name;

      return next();
    } catch (err) {
      console.error("Socket.IO auth error:", err.message);
      return next(new Error("Authentication failed."));
    }
  });

  // ─── Connection handler ────────────────────────────────────────────────────
  io.on("connection", (socket) => {

    // ── room:join (Canonical) & join-room (Legacy Alias) ───────────────────
    socket.on("room:join", (payload) => handleJoin(socket, payload));
    socket.on("join-room", (payload) => handleJoin(socket, payload));

    // ── yjs:update (Primary CRDT incremental sync) ─────────────────────────
    socket.on("yjs:update", (payload) => handleYjsUpdate(socket, payload));

    // ── code:update (Canonical Text Sync) & code-change (Legacy Alias) ────
    socket.on("code:update", (payload) => handleCodeUpdate(socket, payload));
    socket.on("code-change", (payload) => {
      handleCodeUpdate(socket, {
        fileId: payload?.fileId || "f-1",
        content: payload?.content ?? "",
        language: payload?.language || "javascript",
      });
    });

    // ── room:sync ──────────────────────────────────────────────────────────
    socket.on("room:sync", async () => {
      const roomCode = socket.currentRoom;
      if (!roomCode) {
        return socket.emit("room:error", { message: "You are not in a room." });
      }

      // Re-verify authorization
      const isMember = await roomService.isParticipant(roomCode, socket.userId);
      if (!isMember) {
        return socket.emit("room:error", { message: "Access denied to room." });
      }

      const snapshot = roomStateStore.getRoomSnapshot(roomCode);
      const presence = roomStateStore.getPresence(roomCode);
      socket.emit("room:state", { state: snapshot, presence });
    });

    // ── room:leave ─────────────────────────────────────────────────────────
    socket.on("room:leave", () => {
      if (socket.currentRoom) {
        leaveRoom(io, socket, socket.currentRoom);
      }
    });

    // ── chat:message & chat-message (Legacy) ───────────────────────────────
    socket.on("chat:message", (payload) => {
      const text = typeof payload === "string" ? payload : (payload?.text || payload?.message?.text || "");
      const clientMsgId = typeof payload === "object" ? (payload?.id || payload?.message?.id) : null;
      handleChat(io, socket, text, false, clientMsgId);
    });
    socket.on("chat-message", (payload) => {
      const text = typeof payload === "string" ? payload : (payload?.message?.text || payload?.text || "");
      const clientMsgId = typeof payload === "object" ? (payload?.message?.id || payload?.id) : null;
      handleChat(io, socket, text, true, clientMsgId);
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      if (socket.currentRoom) {
        leaveRoom(io, socket, socket.currentRoom);
      } else {
        roomStateStore.removeSocket(socket.id);
      }
    });
  });

  // ─── Event handler implementations ────────────────────────────────────────

  /**
   * Handles room joining with authorization and TiDB re-hydration.
   */
  async function handleJoin(socket, payload) {
    try {
      if (roomStateStore.isShuttingDown()) {
        return socket.emit("room:error", { message: "Server is shutting down. Room joining is unavailable." });
      }

      const rawCode = (payload?.roomCode || payload?.room || "")
        .toString()
        .trim()
        .toUpperCase();

      if (!/^[A-Z0-9]{6}$/.test(rawCode)) {
        return socket.emit("room:error", { message: "Invalid room code." });
      }

      // Check authorization against TiDB
      const isMember = await roomService.isParticipant(rawCode, socket.userId);
      if (!isMember) {
        return socket.emit("room:error", {
          message: "You are not a participant in this room. Please join via the room page first.",
        });
      }

      // Room switching support: if socket was already in another room, leave it cleanly first
      if (socket.currentRoom && socket.currentRoom !== rawCode) {
        leaveRoom(io, socket, socket.currentRoom);
      }

      // Re-hydrate room documents from TiDB if not already in memory
      await roomStateStore.ensureRoomLoaded(rawCode, roomService);

      // Join the Socket.IO room channel
      socket.join(rawCode);
      socket.currentRoom = rawCode;
      roomStateStore.addSocket(socket.id, socket.userId, socket.userName, rawCode);

      const snapshot = roomStateStore.getRoomSnapshot(rawCode);
      const presence = roomStateStore.getPresence(rawCode);

      // Send the joining user the complete authoritative state (text + Yjs binary)
      socket.emit("room:joined", { roomCode: rawCode, state: snapshot, presence });

      // Legacy presence event for backwards compatibility
      socket.emit("room-update", {
        members: presence.map((p) => p.userName),
        room: rawCode,
      });

      // Notify other participants in the room
      socket.to(rawCode).emit("user:joined", {
        userId: socket.userId,
        userName: socket.userName,
      });

      // Broadcast updated presence to all sockets in the room
      const updatedPresence = roomStateStore.getPresence(rawCode);
      io.to(rawCode).emit("user:presence", { presence: updatedPresence });
      io.to(rawCode).emit("room-update", {
        members: updatedPresence.map((p) => p.userName),
        room: rawCode,
      });
    } catch (err) {
      console.error("handleJoin error:", err.message);
      socket.emit("room:error", { message: "Failed to join room." });
    }
  }

  /**
   * Handles Yjs CRDT incremental binary updates.
   * Authoritative collaborative synchronization channel.
   */
  function handleYjsUpdate(socket, payload) {
    try {
      if (roomStateStore.isShuttingDown()) {
        return socket.emit("room:error", { message: "Server is shutting down. Edits are temporarily locked." });
      }

      const roomCode = socket.currentRoom;
      if (!roomCode) {
        return socket.emit("room:error", { message: "You are not in a room." });
      }

      const { fileId, update } = payload || {};
      if (!fileId || typeof fileId !== "string" || fileId.length > 200) return;
      if (!update) return;

      const updateBytes = update instanceof Uint8Array ? update : new Uint8Array(update);

      if (updateBytes.byteLength > MAX_UPDATE_BYTES) {
        return socket.emit("room:error", { message: "Yjs update exceeds payload limit." });
      }

      // Apply CRDT update to server Y.Doc & schedule TiDB persistence
      roomStateStore.applyYjsUpdate(roomCode, fileId, updateBytes, socket.userId);

      // Broadcast Yjs update to ALL OTHER sockets in the room (echo prevention)
      // Note: We do NOT emit code:update here to avoid duplicate synchronization channels
      // and prevent overwriting concurrent CRDT edits on clients.
      socket.to(roomCode).emit("yjs:update", {
        fileId,
        update: Array.from(updateBytes),
        sentBy: socket.userId,
      });
    } catch (err) {
      console.error("handleYjsUpdate error:", err.message);
    }
  }

  /**
   * Handles canonical text code updates (`code:update`).
   * Supported for backwards compatibility with non-Yjs clients or test suites.
   */
  function handleCodeUpdate(socket, payload) {
    try {
      if (roomStateStore.isShuttingDown()) {
        return socket.emit("room:error", { message: "Server is shutting down. Edits are temporarily locked." });
      }

      const roomCode = socket.currentRoom;
      if (!roomCode) {
        return socket.emit("room:error", { message: "You are not in a room." });
      }

      const { fileId, content, language } = payload || {};

      if (!fileId || typeof fileId !== "string" || fileId.length > 200) return;
      if (typeof content !== "string") return;

      if (Buffer.byteLength(content, "utf8") > MAX_CODE_BYTES) {
        return socket.emit("room:error", { message: "Code content exceeds the 200 KB limit." });
      }

      const safeLanguage = typeof language === "string" ? language.slice(0, 50) : "javascript";

      // Update server Y.Doc & schedule TiDB persistence
      const yjsUpdate = roomStateStore.updateFile(roomCode, fileId, content, safeLanguage, socket.userId);

      // Broadcast text update to ALL OTHER clients in room (echo prevention)
      socket.to(roomCode).emit("code:update", {
        fileId,
        content,
        language: safeLanguage,
        sentBy: socket.userId,
      });

      // Also broadcast Yjs binary update so Yjs-bound peers stay converged
      socket.to(roomCode).emit("yjs:update", {
        fileId,
        update: Array.from(yjsUpdate),
        sentBy: socket.userId,
      });

      // Emit legacy event name for backward compatibility
      socket.to(roomCode).emit("code-change", { fileId, content });
    } catch (err) {
      console.error("handleCodeUpdate error:", err.message);
    }
  }

  /**
   * Handles chat messages with reliable message IDs and echo deduplication support.
   */
  function handleChat(io, socket, text, emitLegacy = false, clientMsgId = null) {
    const roomCode = socket.currentRoom;
    if (!roomCode) return;

    const safeText = (text || "").toString().trim();
    if (!safeText || safeText.length > MAX_CHAT_LENGTH) return;

    // Use consistent client-provided message ID if provided and valid, otherwise generate
    const msgId =
      typeof clientMsgId === "string" &&
      clientMsgId.trim().length > 0 &&
      clientMsgId.length <= 100
        ? clientMsgId.trim()
        : `msg-${Date.now()}-${socket.id.slice(0, 6)}`;

    const msg = {
      id: msgId,
      senderId: socket.userId,
      senderName: socket.userName,
      text: safeText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    io.to(roomCode).emit("chat:message", msg);
    if (emitLegacy) {
      io.to(roomCode).emit("chat-message", msg);
    }
  }

  /**
   * Removes a socket from a room, updates presence, and emits events.
   * Multi-tab safe: user:left is only emitted when their last socket leaves.
   */
  function leaveRoom(io, socket, roomCode) {
    roomStateStore.removeSocket(socket.id);
    socket.leave(roomCode);
    socket.currentRoom = null;

    // Check if the user still has other open sockets/tabs in this room
    const remaining = roomStateStore.countUserSockets(roomCode, socket.userId);

    if (remaining === 0) {
      socket.to(roomCode).emit("user:left", {
        userId: socket.userId,
        userName: socket.userName,
      });
    }

    const presence = roomStateStore.getPresence(roomCode);
    io.to(roomCode).emit("user:presence", { presence });
    io.to(roomCode).emit("room-update", {
      members: presence.map((p) => p.userName),
      room: roomCode,
    });
  }

  return io;
}

module.exports = { createSocketHandler };
