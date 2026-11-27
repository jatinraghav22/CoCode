"use strict";

const Y = require("yjs");
const { logger } = require("../../utils/logger");

/**
 * RoomStateStore — production-grade collaboration state store combining
 * Yjs CRDT in-memory documents with persistent TiDB Cloud synchronization.
 *
 * Architecture & Hardening:
 * 1. Each active room file is represented by a server-side `Y.Doc`.
 * 2. Room loading race condition is resolved via per-room promise sharing.
 *    Multiple concurrent joins await a single loading promise and receive
 *    the exact same hydrated Y.Doc instances.
 * 3. File content and serialized Yjs binary state (`yjsState`) are debounced
 *    and persisted transactionally to TiDB Cloud via Prisma (`RoomDocument` table).
 * 4. Pending saves are tracked (`isDirty`) and writes per file are sequenced
 *    (`inFlightSave`) to prevent older saves from overwriting newer document versions.
 * 5. Failed saves are retried with bounded exponential backoff.
 * 6. Graceful shutdown locks new writes and flushes all dirty documents
 *    with a bounded timeout.
 * 7. When a server restarts, room documents and CRDT state are automatically
 *    re-hydrated from TiDB Cloud without any lost state.
 * 8. Multi-tab socket presence is accurately tracked per (roomCode, userId).
 */
class RoomStateStore {
  constructor() {
    /**
     * Map of roomCode -> {
     *   code: string,
     *   files: Map<fileId, {
     *     fileId: string,
     *     filename: string,
     *     language: string,
     *     yDoc: Y.Doc,
     *     yText: Y.Text,
     *     content: string,
     *     version: number,
     *     lastSavedVersion: number,
     *     isDirty: boolean,
     *     lastUpdatedBy: string|null,
     *     lastUpdatedAt: number,
     *     saveTimer: Timeout|null,
     *     inFlightSave: Promise|null,
     *     retryCount: number
     *   }>
     * }
     */
    this._rooms = new Map();

    /**
     * Map of roomCode -> Promise<roomData>
     * Tracks in-flight room loading to resolve concurrent hydration races.
     */
    this._loadingPromises = new Map();

    /**
     * Map of socketId -> { userId, userName, roomCode }
     */
    this._sockets = new Map();

    /**
     * Reference to RoomService for TiDB persistence
     */
    this._roomService = null;

    /**
     * Flag indicating whether graceful shutdown is in progress.
     */
    this._isShuttingDown = false;
  }

  /**
   * Binds RoomService for database persistence.
   * @param {Object} roomService
   */
  setRoomService(roomService) {
    this._roomService = roomService;
  }

  /**
   * Marks whether graceful shutdown is underway.
   * @param {boolean} val
   */
  setShuttingDown(val) {
    this._isShuttingDown = Boolean(val);
  }

  /**
   * Returns whether the store is currently shutting down.
   * @returns {boolean}
   */
  isShuttingDown() {
    return this._isShuttingDown;
  }

  // ─── Room & Document Lifecycle ─────────────────────────────────────────────

  /**
   * Initializes or re-hydrates a room from TiDB Cloud.
   * Concurrent requests for the same room share ONE loading promise.
   * Callers never see an incompletely hydrated room.
   * If loading fails, the promise is cleaned up so subsequent requests can retry.
   *
   * @param {string} roomCode
   * @param {Object} [roomService]
   * @returns {Promise<Object>}
   */
  async ensureRoomLoaded(roomCode, roomService = this._roomService) {
    const normalized = roomCode.toUpperCase();

    // Fast path: room is already loaded and ready in memory
    if (this._rooms.has(normalized)) {
      return this._rooms.get(normalized);
    }

    // Concurrent request: share the existing in-flight loading promise
    if (this._loadingPromises.has(normalized)) {
      return this._loadingPromises.get(normalized);
    }

    // Initiate single loading promise for all concurrent callers
    const loadPromise = (async () => {
      try {
        const roomData = {
          code: normalized,
          files: new Map(),
          whiteboard: {
            elements: new Map(),
            updatedAt: Date.now(),
          },
        };

        // Re-hydrate persistent documents from TiDB Cloud if roomService is available
        if (roomService && typeof roomService.getRoomDocuments === "function") {
          const dbDocs = await roomService.getRoomDocuments(normalized);
          for (const doc of dbDocs) {
            const yDoc = new Y.Doc();

            // Issue 4: restore from binary yjsState if present; fallback to plain-text content
            if (doc.yjsState && (doc.yjsState.length > 0 || doc.yjsState.byteLength > 0)) {
              try {
                const bytes = doc.yjsState instanceof Uint8Array
                  ? doc.yjsState
                  : Buffer.isBuffer(doc.yjsState)
                    ? new Uint8Array(doc.yjsState)
                    : new Uint8Array(doc.yjsState);
                Y.applyUpdate(yDoc, bytes);
              } catch (e) {
                logger.warn("ROOM", `Failed to apply binary yjsState for doc ${doc.fileId}, falling back to content: ${e.message}`);
                const yText = yDoc.getText("monaco");
                yText.insert(0, doc.content || "");
              }
            } else {
              const yText = yDoc.getText("monaco");
              yText.insert(0, doc.content || "");
            }

            const yText = yDoc.getText("monaco");
            const currentContent = yText.toString();

            roomData.files.set(doc.fileId, {
              fileId: doc.fileId,
              filename: doc.filename || doc.fileId,
              language: doc.language || "javascript",
              yDoc,
              yText,
              content: currentContent,
              version: 0,
              lastSavedVersion: 0,
              isDirty: false,
              lastUpdatedBy: null,
              lastUpdatedAt: Date.now(),
              saveTimer: null,
              inFlightSave: null,
              retryCount: 0,
            });
          }
        }

        // Only expose the room to this._rooms once hydration is completely finished
        this._rooms.set(normalized, roomData);
        return roomData;
      } catch (err) {
        // Safe cleanup on error: remove from _rooms so subsequent requests can retry
        this._rooms.delete(normalized);
        throw err;
      } finally {
        // Loading promise has settled (success or failure); clean up tracker
        this._loadingPromises.delete(normalized);
      }
    })();

    this._loadingPromises.set(normalized, loadPromise);
    return loadPromise;
  }

  /**
   * Synchronous check if a room is active in memory.
   * @param {string} roomCode
   * @returns {boolean}
   */
  hasRoom(roomCode) {
    return this._rooms.has(roomCode.toUpperCase());
  }

  /**
   * Gets or creates a file record in memory.
   *
   * @param {string} roomCode
   * @param {string} fileId
   * @param {string} [initialContent=""]
   * @param {string} [language="javascript"]
   * @param {string} [filename]
   * @returns {Object}
   */
  _getOrCreateFile(roomCode, fileId, initialContent = "", language = "javascript", filename = null) {
    const normalized = roomCode.toUpperCase();
    if (!this._rooms.has(normalized)) {
      this._rooms.set(normalized, {
        code: normalized,
        files: new Map(),
        whiteboard: { elements: new Map(), updatedAt: Date.now() },
      });
    }
    const room = this._rooms.get(normalized);

    if (!room.files.has(fileId)) {
      const yDoc = new Y.Doc();
      const yText = yDoc.getText("monaco");
      if (initialContent) {
        yText.insert(0, initialContent);
      }

      room.files.set(fileId, {
        fileId,
        filename: filename || fileId,
        language: language || "javascript",
        yDoc,
        yText,
        content: initialContent || "",
        version: 0,
        lastSavedVersion: 0,
        isDirty: false,
        lastUpdatedBy: null,
        lastUpdatedAt: Date.now(),
        saveTimer: null,
        inFlightSave: null,
        retryCount: 0,
      });
    }

    return room.files.get(fileId);
  }

  /**
   * Applies an incoming binary Yjs CRDT update to the server's Y.Doc.
   * Automatically extracts text and schedules debounced persistence to TiDB.
   *
   * @param {string} roomCode
   * @param {string} fileId
   * @param {Uint8Array|ArrayBuffer|Array<number>} updateBytes
   * @param {string} [userId]
   * @returns {{ content: string, language: string, filename: string }}
   */
  applyYjsUpdate(roomCode, fileId, updateBytes, userId = null) {
    if (this._isShuttingDown) {
      throw new Error("Server is shutting down; writes rejected.");
    }

    const file = this._getOrCreateFile(roomCode, fileId);

    const binary = updateBytes instanceof Uint8Array ? updateBytes : new Uint8Array(updateBytes);
    Y.applyUpdate(file.yDoc, binary);

    file.content = file.yText.toString();
    file.version = (file.version || 0) + 1;
    file.isDirty = true;
    file.lastUpdatedBy = userId;
    file.lastUpdatedAt = Date.now();

    this._scheduleDebouncedSave(roomCode, file);

    return {
      content: file.content,
      language: file.language,
      filename: file.filename,
    };
  }

  /**
   * Updates file content directly (used for full-document or legacy sync events).
   *
   * @param {string} roomCode
   * @param {string} fileId
   * @param {string} content
   * @param {string} [language]
   * @param {string} [userId]
   * @param {string} [filename]
   * @returns {Uint8Array} Yjs update representing the change
   */
  updateFile(roomCode, fileId, content, language = "javascript", userId = null, filename = null) {
    if (this._isShuttingDown) {
      throw new Error("Server is shutting down; writes rejected.");
    }

    const file = this._getOrCreateFile(roomCode, fileId, "", language, filename);

    const newContent = typeof content === "string" ? content : "";

    file.yDoc.transact(() => {
      const current = file.yText.toString();
      if (current !== newContent) {
        file.yText.delete(0, file.yText.length);
        file.yText.insert(0, newContent);
      }
    });

    file.content = newContent;
    if (language) file.language = language;
    if (filename) file.filename = filename;
    file.version = (file.version || 0) + 1;
    file.isDirty = true;
    file.lastUpdatedBy = userId;
    file.lastUpdatedAt = Date.now();

    this._scheduleDebouncedSave(roomCode, file);

    return Y.encodeStateAsUpdate(file.yDoc);
  }

  /**
   * Schedules a debounced save to TiDB Cloud (default 1000ms delay).
   *
   * @param {string} roomCode
   * @param {Object} file
   * @param {number} [delayMs=1000]
   */
  _scheduleDebouncedSave(roomCode, file, delayMs = 1000) {
    if (!this._roomService) return;

    if (file.saveTimer) {
      clearTimeout(file.saveTimer);
      file.saveTimer = null;
    }

    file.saveTimer = setTimeout(() => {
      file.saveTimer = null;
      this._executeSave(roomCode, file).catch(() => {});
    }, delayMs);

    if (typeof file.saveTimer.unref === "function") {
      file.saveTimer.unref();
    }
  }

  /**
   * Executes a database save for a file.
   * Ensures serial execution per file to prevent older saves from overwriting newer document versions.
   * Uses bounded exponential backoff on failure.
   *
   * @param {string} roomCode
   * @param {Object} file
   * @returns {Promise<void>}
   */
  async _executeSave(roomCode, file) {
    if (file.saveTimer) {
      clearTimeout(file.saveTimer);
      file.saveTimer = null;
    }

    // If a save is already in flight for this file, await it first
    if (file.inFlightSave) {
      try {
        await file.inFlightSave;
      } catch {
        // Will be retried if still dirty
      }
      if (!file.isDirty) return;
    }

    const versionToSave = file.version;
    const contentToSave = file.content;
    const filenameToSave = file.filename;
    const languageToSave = file.language;
    // Issue 4: serialize binary Yjs state alongside plain text
    const yjsStateToSave = Buffer.from(Y.encodeStateAsUpdate(file.yDoc));

    const savePromise = (async () => {
      try {
        await this._roomService.saveRoomDocument({
          roomCode,
          fileId: file.fileId,
          filename: filenameToSave,
          language: languageToSave,
          content: contentToSave,
          yjsState: yjsStateToSave,
        });

        file.lastSavedVersion = Math.max(file.lastSavedVersion || 0, versionToSave);
        if (file.version === versionToSave) {
          file.isDirty = false;
        }
        file.retryCount = 0;
      } catch (err) {
        logger.error("ROOM", `Save failed for room ${roomCode} file ${file.fileId}:`, err);
        file.isDirty = true;

        const MAX_RETRIES = 3;
        if (file.retryCount < MAX_RETRIES && !this._isShuttingDown) {
          file.retryCount++;
          const backoffMs = Math.min(500 * Math.pow(2, file.retryCount - 1), 4000);
          this._scheduleDebouncedSave(roomCode, file, backoffMs);
        }
        throw err;
      } finally {
        if (file.inFlightSave === savePromise) {
          file.inFlightSave = null;
        }
      }
    })();

    file.inFlightSave = savePromise;
    return savePromise;
  }

  /**
   * Returns authoritative snapshot of all files in a room, including full text
   * and serialized Yjs binary updates for instant CRDT client synchronization.
   *
   * @param {string} roomCode
   * @returns {Object|null}
   */
  getRoomSnapshot(roomCode) {
    const normalized = roomCode.toUpperCase();
    if (!this._rooms.has(normalized)) return null;

    const room = this._rooms.get(normalized);
    const files = [];

    for (const [fileId, file] of room.files.entries()) {
      files.push({
        fileId,
        filename: file.filename,
        language: file.language,
        content: file.content,
        yjsUpdate: Array.from(Y.encodeStateAsUpdate(file.yDoc)),
        updatedAt: file.lastUpdatedAt,
      });
    }

    return {
      code: normalized,
      files,
    };
  }

  /**
   * Returns a specific file from a room.
   *
   * @param {string} roomCode
   * @param {string} fileId
   * @returns {Object|null}
   */
  getFile(roomCode, fileId) {
    const normalized = roomCode.toUpperCase();
    if (!this._rooms.has(normalized)) return null;
    return this._rooms.get(normalized).files.get(fileId) || null;
  }

  // ─── Isolated Room Whiteboard State ────────────────────────────────────────

  _ensureWhiteboard(roomCode) {
    const normalized = roomCode.toUpperCase();
    if (!this._rooms.has(normalized)) {
      this._rooms.set(normalized, {
        code: normalized,
        files: new Map(),
        whiteboard: { elements: new Map(), updatedAt: Date.now() },
      });
    }
    const room = this._rooms.get(normalized);
    if (!room.whiteboard) {
      room.whiteboard = { elements: new Map(), updatedAt: Date.now() };
    }
    return room.whiteboard;
  }

  /**
   * Upserts a validated whiteboard element into the room's isolated whiteboard state.
   *
   * @param {string} roomCode
   * @param {Object} element
   * @param {number} [maxElements=2000]
   * @returns {{ ok: true, element: Object } | { ok: false, error: string }}
   */
  upsertWhiteboardElement(roomCode, element, maxElements = 2000) {
    if (this._isShuttingDown) {
      return { ok: false, error: "Server is shutting down; whiteboard writes rejected." };
    }
    const wb = this._ensureWhiteboard(roomCode);
    if (!wb.elements.has(element.id) && wb.elements.size >= maxElements) {
      return { ok: false, error: "Whiteboard element limit reached. Please clear the canvas." };
    }
    wb.elements.set(element.id, element);
    wb.updatedAt = Date.now();
    return { ok: true, element };
  }

  /**
   * Deletes a whiteboard element by ID from the room's whiteboard state.
   *
   * @param {string} roomCode
   * @param {string} elementId
   * @returns {boolean}
   */
  deleteWhiteboardElement(roomCode, elementId) {
    if (this._isShuttingDown) return false;
    const wb = this._ensureWhiteboard(roomCode);
    const deleted = wb.elements.delete(elementId);
    if (deleted) {
      wb.updatedAt = Date.now();
    }
    return deleted;
  }

  /**
   * Clears all whiteboard elements for a specific room.
   *
   * @param {string} roomCode
   */
  clearWhiteboard(roomCode) {
    if (this._isShuttingDown) return;
    const wb = this._ensureWhiteboard(roomCode);
    wb.elements.clear();
    wb.updatedAt = Date.now();
  }

  /**
   * Returns all whiteboard elements for a room in insertion order.
   *
   * @param {string} roomCode
   * @returns {Array<Object>}
   */
  getWhiteboardElements(roomCode) {
    const normalized = roomCode.toUpperCase();
    const room = this._rooms.get(normalized);
    if (!room || !room.whiteboard) return [];
    return Array.from(room.whiteboard.elements.values());
  }

  /**
   * Flushes any pending debounced saves to TiDB immediately.
   * The entire flush — including waiting for in-progress hydrations,
   * collecting dirty files from loaded rooms, and completing database saves —
   * is bounded by a single overall deadline (timeoutMs).
   *
   * When hydration times out, reports both:
   *   1. Every room still being hydrated (type: "room", fileId: null)
   *   2. Every dirty or in-flight file in already-loaded rooms (type: "file", fileId: <id>)
   *
   * Does not return early before collecting dirty files from loaded rooms.
   * Avoids duplicate entries.
   *
   * Note: `Promise.race` does NOT cancel pending database operations on the
   * database server. The timeout bounds the server's waiting time so process
   * termination is never stalled indefinitely.
   *
   * @param {string} [roomCode]
   * @param {Object} [options]
   * @param {number} [options.timeoutMs=10000]
   * @returns {Promise<{ success: boolean, unsaved: Array, timedOut: boolean }>}
   */
  async flush(roomCode = null, { timeoutMs = 10000 } = {}) {
    if (!this._roomService) {
      return { success: true, unsaved: [], timedOut: false };
    }

    const deadline = Date.now() + timeoutMs;
    let timedOut = false;
    const unsaved = [];
    const seenKeys = new Set();

    const addUnsaved = (entry) => {
      const key = `${entry.type || "file"}:${entry.roomCode}:${entry.fileId || "*"}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        unsaved.push(entry);
      }
    };

    // Helper: races a promise against the remaining deadline.
    // Returns { value, timedOut } so the caller can inspect both outcomes.
    const raceDeadline = (promise) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return Promise.resolve({ value: undefined, timedOut: true });
      }
      let handle = null;
      const timer = new Promise((resolve) => {
        handle = setTimeout(() => resolve({ value: undefined, timedOut: true }), remaining);
      });
      return Promise.race([
        promise.then(
          (v) => { if (handle) clearTimeout(handle); return { value: v, timedOut: false }; },
          (e) => { if (handle) clearTimeout(handle); throw e; }
        ),
        timer,
      ]);
    };

    // 1. Await in-progress room hydration under the deadline so all
    //    documents are discovered before we try to save them.
    if (this._loadingPromises.size > 0) {
      const loadingEntries = roomCode
        ? (this._loadingPromises.has(roomCode.toUpperCase())
            ? [[roomCode.toUpperCase(), this._loadingPromises.get(roomCode.toUpperCase())]]
            : [])
        : Array.from(this._loadingPromises.entries());

      if (loadingEntries.length > 0) {
        try {
          const hydrationResult = await raceDeadline(
            Promise.allSettled(loadingEntries.map(([, p]) => p))
          );
          if (hydrationResult.timedOut) {
            timedOut = true;
            logger.error("ROOM", `Flush deadline expired while awaiting room hydration (${timeoutMs}ms).`);
            for (const [loadingCode] of loadingEntries) {
              addUnsaved({
                type: "room",
                roomCode: loadingCode,
                fileId: null,
                error: "Room hydration timed out",
              });
            }
          }
        } catch {
          // Hydration errors are handled within ensureRoomLoaded
        }
      }
    }

    // 2. Gather rooms and dirty files from already-loaded rooms.
    // Do NOT return early even if hydration timed out; always collect
    // dirty or in-flight files from loaded rooms.
    const roomsToFlush = roomCode
      ? [this._rooms.get(roomCode.toUpperCase())].filter(Boolean)
      : Array.from(this._rooms.values());

    const saveTargets = [];

    for (const room of roomsToFlush) {
      for (const file of room.files.values()) {
        if (file.saveTimer) {
          clearTimeout(file.saveTimer);
          file.saveTimer = null;
        }

        if (file.isDirty || file.inFlightSave) {
          saveTargets.push({ roomCode: room.code, file });
        }
      }
    }

    // 3. If deadline is already exhausted (e.g. hydration used up all budget),
    // record all dirty files as unsaved immediately.
    // Otherwise, attempt to execute and await saves under remaining deadline.
    const remainingTime = deadline - Date.now();
    if ((timedOut || remainingTime <= 0) && saveTargets.length > 0) {
      timedOut = true;
      for (const { roomCode: rCode, file } of saveTargets) {
        addUnsaved({
          type: "file",
          roomCode: rCode,
          fileId: file.fileId,
          error: "Save timed out",
        });
      }
    } else if (saveTargets.length > 0) {
      const savePromises = [];
      for (const { roomCode: rCode, file } of saveTargets) {
        savePromises.push(
          (async () => {
            try {
              await this._executeSave(rCode, file);
              return null;
            } catch (err) {
              return {
                type: "file",
                roomCode: rCode,
                fileId: file.fileId,
                error: err.message,
              };
            }
          })()
        );
      }

      try {
        const saveResult = await raceDeadline(Promise.all(savePromises));
        if (saveResult.timedOut) {
          timedOut = true;
          logger.error("ROOM", `Flush timed out after ${timeoutMs}ms with ${savePromises.length} save(s) outstanding.`);
          // Report every file that is still dirty or in-flight
          for (const { roomCode: rCode, file } of saveTargets) {
            if (file.isDirty || file.inFlightSave) {
              addUnsaved({
                type: "file",
                roomCode: rCode,
                fileId: file.fileId,
                error: "Save timed out",
              });
            }
          }
        } else if (Array.isArray(saveResult.value)) {
          for (const item of saveResult.value) {
            if (item) {
              addUnsaved(item);
            }
          }
        }
      } catch (err) {
        for (const { roomCode: rCode, file } of saveTargets) {
          if (file.isDirty || file.inFlightSave) {
            addUnsaved({
              type: "file",
              roomCode: rCode,
              fileId: file.fileId,
              error: err.message,
            });
          }
        }
      }
    }

    const success = unsaved.length === 0 && !timedOut;
    return { success, unsaved, timedOut };
  }

  // ─── Socket Presence & Multi-Tab Tracking ──────────────────────────────────

  /**
   * Registers a connected socket to a room.
   * @param {string} socketId
   * @param {string} userId
   * @param {string} userName
   * @param {string} roomCode
   */
  addSocket(socketId, userId, userName, roomCode) {
    this._sockets.set(socketId, { userId, userName, roomCode: roomCode.toUpperCase() });
  }

  /**
   * Removes a socket from tracking.
   * @param {string} socketId
   * @returns {Object|null}
   */
  removeSocket(socketId) {
    const info = this._sockets.get(socketId) || null;
    this._sockets.delete(socketId);
    return info;
  }

  /**
   * Returns socket info.
   * @param {string} socketId
   * @returns {Object|null}
   */
  getSocket(socketId) {
    return this._sockets.get(socketId) || null;
  }

  /**
   * Returns the count of active sockets for a given user in a room.
   * Supports multi-tab tracking (user is only offline when count === 0).
   *
   * @param {string} roomCode
   * @param {string} userId
   * @returns {number}
   */
  countUserSockets(roomCode, userId) {
    const normalized = roomCode.toUpperCase();
    let count = 0;
    for (const info of this._sockets.values()) {
      if (info.roomCode === normalized && info.userId === userId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns a deduplicated list of active users in a room.
   *
   * @param {string} roomCode
   * @returns {Array<{ userId: string, userName: string }>}
   */
  getPresence(roomCode) {
    const normalized = roomCode.toUpperCase();
    const seen = new Map();
    for (const info of this._sockets.values()) {
      if (info.roomCode === normalized && !seen.has(info.userId)) {
        seen.set(info.userId, { userId: info.userId, userName: info.userName });
      }
    }
    return Array.from(seen.values());
  }
}

// Singleton instance shared across server-v2
const roomStateStore = new RoomStateStore();

module.exports = { roomStateStore, RoomStateStore };
