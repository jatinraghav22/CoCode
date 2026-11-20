"use strict";

/**
 * RoomService — manages CollaborationRoom, RoomParticipant, and RoomDocument
 * database operations with Prisma and TiDB Cloud.
 *
 * All room codes are 6-character uppercase alphanumeric strings, e.g. "X9K2PQ".
 * Room documents are stored persistently in the `room_documents` table so
 * that all files, code content, and languages survive server restarts.
 */

/** Generates a cryptographically random 6-char uppercase alphanumeric code. */
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed 0,O,1,I to avoid confusion
  let code = "";
  const array = new Uint8Array(6);
  globalThis.crypto.getRandomValues(array);
  for (const byte of array) {
    code += chars[byte % chars.length];
  }
  return code;
}

/** Default initial files for every newly created collaboration room. */
const DEFAULT_ROOM_DOCUMENTS = [
  {
    fileId: "f-1",
    filename: "index.js",
    language: "javascript",
    content: `function sayHi() {\n    console.log("Hello world");\n}\n\nsayHi();\n`,
  },
  {
    fileId: "f-2",
    filename: "styles.css",
    language: "css",
    content: `body {\n    background: #0f172a;\n    color: #f8fafc;\n    font-family: sans-serif;\n}\n`,
  },
  {
    fileId: "f-3",
    filename: "main.py",
    language: "python",
    content: `# Welcome to CoCode\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("Developer"))\n`,
  },
];

/** Safe user projection — never expose passwordHash. */
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
};

class RoomService {
  /**
   * @param {Object} prisma — PrismaClient instance.
   */
  constructor(prisma) {
    if (!prisma) throw new Error("RoomService requires a prisma client.");
    this.prisma = prisma;
  }

  /**
   * Creates a new collaboration room owned by the authenticated user.
   * Generates a unique 6-char code with collision retry.
   * Initializes persistent default documents in TiDB.
   *
   * @param {Object} options
   * @param {string} options.ownerId — Authenticated user's ID.
   * @param {string} options.name — Human-readable room name.
   * @param {boolean} [options.isPrivate=true]
   * @returns {Promise<{ room: Object }>}
   */
  async createRoom({ ownerId, name, isPrivate = true }) {
    if (!ownerId) throw new Error("ownerId is required.");
    if (!name || typeof name !== "string" || name.trim().length < 3) {
      throw new Error("Room name must be at least 3 characters.");
    }
    if (name.trim().length > 60) {
      throw new Error("Room name cannot exceed 60 characters.");
    }

    // Generate a unique room code (retry up to 5 times on collision)
    let code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRoomCode();
      const existing = await this.prisma.collaborationRoom.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!existing) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new Error("Could not generate a unique room code. Please try again.");
    }

    // Create room + owner's participant record + default starter documents in a transaction
    const room = await this.prisma.collaborationRoom.create({
      data: {
        code,
        name: name.trim(),
        isPrivate: Boolean(isPrivate),
        isActive: true,
        ownerId,
        participants: {
          create: {
            userId: ownerId,
          },
        },
        documents: {
          create: DEFAULT_ROOM_DOCUMENTS.map((doc) => ({
            fileId: doc.fileId,
            filename: doc.filename,
            language: doc.language,
            content: doc.content,
          })),
        },
      },
      include: {
        owner: { select: SAFE_USER_SELECT },
        participants: {
          include: {
            user: { select: SAFE_USER_SELECT },
          },
        },
        documents: true,
      },
    });

    return { room: this._formatRoom(room) };
  }

  /**
   * Finds a room by its 6-char invite code.
   *
   * @param {string} code
   * @returns {Promise<Object|null>}
   */
  async getRoomByCode(code) {
    if (!code || typeof code !== "string") return null;

    const room = await this.prisma.collaborationRoom.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        owner: { select: SAFE_USER_SELECT },
        participants: {
          include: {
            user: { select: SAFE_USER_SELECT },
          },
        },
        documents: true,
      },
    });

    if (!room) return null;
    return this._formatRoom(room);
  }

  /**
   * Joins a room by its invite code.
   * Race-safe & idempotent: concurrent join requests are safely handled.
   * Rejects if the room is inactive (410) or not found (404).
   *
   * @param {Object} options
   * @param {string} options.userId — Authenticated user's ID.
   * @param {string} options.roomCode — 6-char invite code.
   * @returns {Promise<{ room: Object, isNew: boolean }>}
   */
  async joinRoom({ userId, roomCode }) {
    if (!userId) throw new Error("userId is required.");
    if (!roomCode || !/^[A-Z0-9]{6}$/.test(roomCode.toUpperCase())) {
      throw new Error("Invalid room code format.");
    }

    const normalizedCode = roomCode.toUpperCase();

    const room = await this.prisma.collaborationRoom.findUnique({
      where: { code: normalizedCode },
      include: {
        owner: { select: SAFE_USER_SELECT },
        participants: {
          include: { user: { select: SAFE_USER_SELECT } },
        },
        documents: true,
      },
    });

    if (!room) {
      const err = new Error("Room not found.");
      err.statusCode = 404;
      throw err;
    }

    if (!room.isActive) {
      const err = new Error("This room has been closed.");
      err.statusCode = 410;
      throw err;
    }

    let isNew = false;
    const existing = room.participants.find((p) => p.userId === userId);

    if (!existing) {
      try {
        if (this.prisma.roomParticipant.upsert) {
          await this.prisma.roomParticipant.upsert({
            where: {
              roomId_userId: {
                roomId: room.id,
                userId,
              },
            },
            create: { roomId: room.id, userId },
            update: {},
          });
        } else {
          await this.prisma.roomParticipant.create({
            data: { roomId: room.id, userId },
          });
        }
        isNew = true;
      } catch (err) {
        // P2002: Unique constraint collision from concurrent join request
        if (err.code === "P2002") {
          isNew = false;
        } else {
          throw err;
        }
      }
    }

    // Reload room with up-to-date participants
    const updated = await this.prisma.collaborationRoom.findUnique({
      where: { code: normalizedCode },
      include: {
        owner: { select: SAFE_USER_SELECT },
        participants: {
          include: { user: { select: SAFE_USER_SELECT } },
        },
        documents: true,
      },
    });

    return { room: this._formatRoom(updated), isNew };
  }

  /**
   * Fetches safe room info for a given roomId.
   *
   * @param {string} roomId
   * @returns {Promise<Object|null>}
   */
  async getRoomById(roomId) {
    const room = await this.prisma.collaborationRoom.findUnique({
      where: { id: roomId },
      include: {
        owner: { select: SAFE_USER_SELECT },
        participants: {
          include: { user: { select: SAFE_USER_SELECT } },
        },
        documents: true,
      },
    });
    if (!room) return null;
    return this._formatRoom(room);
  }

  /**
   * Checks whether a user is an enrolled participant in a room (by room code).
   *
   * @param {string} roomCode
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isParticipant(roomCode, userId) {
    if (!roomCode || !userId) return false;
    const room = await this.prisma.collaborationRoom.findUnique({
      where: { code: roomCode.toUpperCase() },
      select: {
        id: true,
        isActive: true,
        participants: {
          where: { userId },
          select: { id: true },
        },
      },
    });
    if (!room || !room.isActive) return false;
    return (room.participants || []).length > 0;
  }

  /**
   * Persistent document: retrieves all persistent documents for a room.
   *
   * @param {string} roomCode
   * @returns {Promise<Array<Object>>}
   */
  async getRoomDocuments(roomCode) {
    if (!roomCode) return [];
    const room = await this.prisma.collaborationRoom.findUnique({
      where: { code: roomCode.toUpperCase() },
      select: {
        id: true,
        documents: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!room) return [];

    // If room has no documents yet, initialize default documents
    if (!room.documents || room.documents.length === 0) {
      const created = [];
      for (const def of DEFAULT_ROOM_DOCUMENTS) {
        try {
          const doc = await this.prisma.roomDocument.create({
            data: {
              roomId: room.id,
              fileId: def.fileId,
              filename: def.filename,
              language: def.language,
              content: def.content,
            },
          });
          created.push(doc);
        } catch {
          // Ignore duplicate creation race
        }
      }
      return created;
    }

    return room.documents;
  }

  /**
   * Persistent document: saves or updates a room file's content and binary Yjs state in TiDB.
   *
   * @param {Object} options
   * @param {string} options.roomCode
   * @param {string} options.fileId
   * @param {string} [options.filename]
   * @param {string} [options.language]
   * @param {string} options.content
   * @param {Buffer|Uint8Array|Array<number>} [options.yjsState]
   * @returns {Promise<Object|null>}
   */
  async saveRoomDocument({ roomCode, fileId, filename, language, content, yjsState = null }) {
    if (!roomCode || !fileId) return null;

    const room = await this.prisma.collaborationRoom.findUnique({
      where: { code: roomCode.toUpperCase() },
      select: { id: true },
    });
    if (!room) return null;

    const cleanFilename = filename || fileId;
    const cleanLanguage = language || "javascript";
    const cleanContent = typeof content === "string" ? content : "";
    const cleanYjsState = yjsState
      ? (Buffer.isBuffer(yjsState) ? yjsState : Buffer.from(yjsState))
      : null;

    const updateData = {
      filename: cleanFilename,
      language: cleanLanguage,
      content: cleanContent,
    };
    if (cleanYjsState !== null) {
      updateData.yjsState = cleanYjsState;
    }

    const createData = {
      roomId: room.id,
      fileId,
      filename: cleanFilename,
      language: cleanLanguage,
      content: cleanContent,
      yjsState: cleanYjsState,
    };

    return this.prisma.roomDocument.upsert({
      where: {
        roomId_fileId: {
          roomId: room.id,
          fileId,
        },
      },
      create: createData,
      update: updateData,
    });
  }

  /**
   * Formats a Prisma room record into a safe API response.
   * Never exposes passwordHash or other sensitive fields.
   *
   * @param {Object} room — Raw Prisma room record with relations.
   * @returns {Object}
   */
  _formatRoom(room) {
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      isPrivate: room.isPrivate,
      isActive: room.isActive,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      owner: room.owner
        ? { id: room.owner.id, name: room.owner.name }
        : null,
      participants: (room.participants || []).map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user?.name || "Unknown",
        joinedAt: p.joinedAt,
      })),
      documents: (room.documents || []).map((d) => ({
        id: d.id,
        fileId: d.fileId,
        filename: d.filename,
        language: d.language,
        content: d.content,
        yjsState: d.yjsState
          ? Array.from(Buffer.isBuffer(d.yjsState) ? d.yjsState : new Uint8Array(d.yjsState))
          : null,
        updatedAt: d.updatedAt,
      })),
      hostName: room.owner?.name || "Unknown",
      members: (room.participants || []).map((p) => p.user?.name || "Unknown"),
    };
  }
}

module.exports = { RoomService, generateRoomCode, DEFAULT_ROOM_DOCUMENTS };
