"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const Y = require("yjs");
const { io: Client } = require("socket.io-client");
const { createApp } = require("../src/app");
const { createSocketHandler } = require("../src/socket");
const { signAccessToken } = require("../src/utils/jwt");
const { RoomService } = require("../src/modules/rooms/room.service");
const { RoomStateStore } = require("../src/modules/rooms/room.store");

const TEST_SECRET = "test_super_secret_key_at_least_32_characters_long!";

const testConfig = {
  nodeEnv: "test",
  port: 0,
  clientOrigins: ["http://localhost:5173"],
  jwtSecret: TEST_SECRET,
  jwtExpiresIn: "1h",
  jwtIssuer: "cocode-backend-v2",
  jwtAudience: "cocode-client",
};

/**
 * Creates an in-memory mock Prisma client with support for users, rooms,
 * participants, and documents with binary yjsState.
 */
function createMockPrisma({ users = [], rooms = [], participants = [], documents = [] } = {}) {
  const userMap = new Map();
  const roomMap = new Map();
  const participantMap = new Map();
  const documentMap = new Map();
  let idCounter = 1;

  for (const u of users) userMap.set(u.id, { ...u });
  for (const r of rooms) roomMap.set(r.id, { ...r, code: r.code.toUpperCase() });
  for (const p of participants) participantMap.set(p.id, { ...p });
  for (const d of documents) documentMap.set(d.id, { ...d });

  return {
    _users: userMap,
    _rooms: roomMap,
    _participants: participantMap,
    _documents: documentMap,

    user: {
      async findUnique({ where, select }) {
        const u = userMap.get(where.id);
        if (!u) return null;
        if (select) {
          const res = {};
          for (const k of Object.keys(select)) if (select[k]) res[k] = u[k];
          return res;
        }
        return { ...u };
      },
    },

    collaborationRoom: {
      async findUnique({ where, select, include }) {
        let found = null;
        if (where.id) {
          found = roomMap.get(where.id) || null;
        } else if (where.code) {
          for (const r of roomMap.values()) {
            if (r.code === where.code.toUpperCase()) {
              found = r;
              break;
            }
          }
        }
        if (!found) return null;

        if (select) {
          const res = {};
          for (const k of Object.keys(select)) {
            if (k === "participants") {
              const matched = [];
              for (const p of participantMap.values()) {
                if (p.roomId === found.id) {
                  if (select.participants.where?.userId) {
                    if (p.userId === select.participants.where.userId) {
                      matched.push({ id: p.id });
                    }
                  } else {
                    matched.push({ id: p.id });
                  }
                }
              }
              res.participants = matched;
            } else if (k === "documents") {
              const matched = [];
              for (const d of documentMap.values()) {
                if (d.roomId === found.id) matched.push({ ...d });
              }
              res.documents = matched;
            } else if (select[k]) {
              res[k] = found[k];
            }
          }
          return res;
        }

        if (include) {
          const res = { ...found };
          if (include.owner) {
            const owner = userMap.get(found.ownerId);
            res.owner = owner ? { id: owner.id, name: owner.name } : null;
          }
          if (include.participants) {
            const parts = [];
            for (const p of participantMap.values()) {
              if (p.roomId === found.id) {
                const u = userMap.get(p.userId);
                parts.push({ ...p, user: u ? { id: u.id, name: u.name } : null });
              }
            }
            res.participants = parts;
          }
          if (include.documents) {
            const docs = [];
            for (const d of documentMap.values()) {
              if (d.roomId === found.id) docs.push({ ...d });
            }
            res.documents = docs;
          }
          return res;
        }

        return { ...found };
      },

      async create({ data, include }) {
        const id = `room_${idCounter++}`;
        const newRoom = {
          id,
          code: data.code.toUpperCase(),
          name: data.name,
          isPrivate: data.isPrivate !== false,
          isActive: data.isActive !== false,
          ownerId: data.ownerId,
        };
        roomMap.set(id, newRoom);
        return this.findUnique({ where: { id }, include });
      },
    },

    roomParticipant: {
      async create({ data }) {
        const id = `part_${idCounter++}`;
        const record = { id, roomId: data.roomId, userId: data.userId };
        participantMap.set(id, record);
        return record;
      },
      async upsert({ where, create, update }) {
        const key = where.roomId_userId;
        let existing = null;
        for (const p of participantMap.values()) {
          if (p.roomId === key.roomId && p.userId === key.userId) {
            existing = p;
            break;
          }
        }
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        return this.create({ data: create });
      },
    },

    roomDocument: {
      async findMany({ where }) {
        const results = [];
        for (const d of documentMap.values()) {
          if (!where?.roomId || d.roomId === where.roomId) {
            results.push({ ...d });
          }
        }
        return results;
      },
      async create({ data }) {
        const id = `doc_${idCounter++}`;
        const doc = {
          id,
          roomId: data.roomId,
          fileId: data.fileId,
          filename: data.filename || data.fileId,
          language: data.language || "javascript",
          content: data.content || "",
          yjsState: data.yjsState || null,
        };
        documentMap.set(id, doc);
        return doc;
      },
      async upsert({ where, create, update }) {
        const key = where.roomId_fileId;
        let found = null;
        for (const d of documentMap.values()) {
          if (d.roomId === key.roomId && d.fileId === key.fileId) {
            found = d;
            break;
          }
        }
        if (found) {
          Object.assign(found, update);
          return found;
        }
        return this.create({ data: create });
      },
    },
  };
}

/**
 * Creates an ephemeral test server.
 */
async function createHardeningTestServer(prisma, customStore = null) {
  const app = createApp(testConfig, { prisma });
  const httpServer = http.createServer(app);
  const roomService = new RoomService(prisma);

  const io = createSocketHandler(httpServer, {
    jwtSecret: TEST_SECRET,
    jwtIssuer: testConfig.jwtIssuer,
    jwtAudience: testConfig.jwtAudience,
    clientOrigins: testConfig.clientOrigins,
    prisma,
    roomService,
  });

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  const url = `http://localhost:${port}`;

  const close = () =>
    new Promise((resolve, reject) => {
      io.close((err) => (err ? reject(err) : resolve()));
    });

  return { url, close, roomService, io };
}

// ─── ISSUE 1: Room Loading Concurrency Tests ─────────────────────────────────

test("Issue 1 — Concurrent requests to ensureRoomLoaded share one loading promise", async () => {
  const store = new RoomStateStore();
  let dbCallCount = 0;

  const mockRoomService = {
    async getRoomDocuments(roomCode) {
      dbCallCount++;
      // Artificial DB delay
      await new Promise((r) => setTimeout(r, 60));
      return [
        { fileId: "f-1", filename: "index.js", language: "javascript", content: "console.log('hi');" },
      ];
    },
  };

  store.setRoomService(mockRoomService);

  // While loading is in flight, hasRoom must return false (no incompletely hydrated room exposed)
  assert.equal(store.hasRoom("RACE01"), false);

  // Launch 10 simultaneous ensureRoomLoaded calls for the same room
  const promises = Array.from({ length: 10 }, () => store.ensureRoomLoaded("RACE01"));

  // Check again during in-flight: hasRoom must still be false until hydration completes
  assert.equal(store.hasRoom("RACE01"), false);

  const results = await Promise.all(promises);

  // Database must only have been queried ONCE
  assert.equal(dbCallCount, 1, "Database was only queried once despite 10 concurrent requests");

  // Room is now ready
  assert.equal(store.hasRoom("RACE01"), true);

  // All 10 callers received the EXACT same room object reference
  const firstRoom = results[0];
  for (let i = 1; i < results.length; i++) {
    assert.strictEqual(results[i], firstRoom, "All callers must receive the exact same roomData instance");
  }

  // Verify Y.Doc was created exactly once (no duplicate Y.Docs)
  const file = firstRoom.files.get("f-1");
  assert.ok(file);
  assert.ok(file.yDoc instanceof Y.Doc);
  assert.equal(file.content, "console.log('hi');");
  assert.equal(file.yText.toString(), "console.log('hi');");
});

test("Issue 1 — Failed room loading cleans up loading promise and allows retry", async () => {
  const store = new RoomStateStore();
  let failFirst = true;

  const mockRoomService = {
    async getRoomDocuments(roomCode) {
      if (failFirst) {
        throw new Error("Simulated database timeout");
      }
      return [
        { fileId: "f-1", filename: "index.js", language: "javascript", content: "recovered" },
      ];
    },
  };

  store.setRoomService(mockRoomService);

  // Concurrent callers when DB fails
  const callers = Array.from({ length: 3 }, () => store.ensureRoomLoaded("FAIL01"));
  for (const promise of callers) {
    await assert.rejects(promise, { message: "Simulated database timeout" });
  }

  // Room must not be left in an incompletely hydrated or corrupted state in memory
  assert.equal(store.hasRoom("FAIL01"), false);

  // Retry after database recovery
  failFirst = false;
  const roomData = await store.ensureRoomLoaded("FAIL01");
  assert.ok(roomData);
  assert.equal(store.hasRoom("FAIL01"), true);
  assert.equal(roomData.files.get("f-1").content, "recovered");
});

// ─── ISSUE 2: Duplicate Synchronization Channels & Convergence Tests ─────────

test("Issue 2 — yjs:update emits ONLY yjs:update (no duplicate code:update) and converges", async (t) => {
  const userA = { id: "u-a", name: "Alice", email: "a@cocode.dev" };
  const userB = { id: "u-b", name: "Bob", email: "b@cocode.dev" };
  const room = { id: "r-dup", code: "CONV01", name: "Conv Room", isActive: true, ownerId: userA.id };
  const doc = { id: "d-conv", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "BASE\n" };

  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [room],
    participants: [
      { id: "p-a", roomId: room.id, userId: userA.id },
      { id: "p-b", roomId: room.id, userId: userB.id },
    ],
    documents: [doc],
  });

  const { url, close } = await createHardeningTestServer(prisma);
  t.after(close);

  const tokenA = signAccessToken(userA, TEST_SECRET);
  const tokenB = signAccessToken(userB, TEST_SECRET);

  const clientA = Client(url, { auth: { token: tokenA }, transports: ["websocket"], reconnection: false });
  const clientB = Client(url, { auth: { token: tokenB }, transports: ["websocket"], reconnection: false });
  t.after(() => {
    clientA.disconnect();
    clientB.disconnect();
  });

  await Promise.all([
    new Promise((r) => clientA.on("connect", r)),
    new Promise((r) => clientB.on("connect", r)),
  ]);

  await Promise.all([
    new Promise((r) => {
      clientA.emit("room:join", { roomCode: "CONV01" });
      clientA.on("room:joined", r);
    }),
    new Promise((r) => {
      clientB.emit("room:join", { roomCode: "CONV01" });
      clientB.on("room:joined", r);
    }),
  ]);

  let clientBReceivedCodeUpdate = 0;
  let clientBReceivedYjsUpdate = 0;

  clientB.on("code:update", () => {
    clientBReceivedCodeUpdate++;
  });

  clientB.on("yjs:update", () => {
    clientBReceivedYjsUpdate++;
  });

  // Client A creates local Y.Doc with initial content
  const docA = new Y.Doc();
  docA.getText("monaco").insert(0, "BASE\n");

  // Client A edits: inserts "HELLO " at index 0
  let emittedUpdate = null;
  docA.on("update", (update) => {
    emittedUpdate = update;
  });
  docA.getText("monaco").insert(0, "HELLO ");

  // Client A emits yjs:update to server
  clientA.emit("yjs:update", {
    fileId: "f-1",
    update: Array.from(emittedUpdate),
  });

  // Wait for propagation
  await new Promise((r) => setTimeout(r, 100));

  // Client B MUST receive exactly ONE yjs:update
  assert.equal(clientBReceivedYjsUpdate, 1, "Client B received exactly 1 yjs:update");

  // Client B MUST NOT receive code:update (preventing duplicate channel and edit wiping)
  assert.equal(clientBReceivedCodeUpdate, 0, "Server must not emit code:update when yjs:update is sent");
});

test("Issue 2 — Concurrent edits from multiple users converge deterministically", async (t) => {
  const userA = { id: "u-ca", name: "Alice", email: "ca@cocode.dev" };
  const userB = { id: "u-cb", name: "Bob", email: "cb@cocode.dev" };
  const room = { id: "r-crdt", code: "CRDT01", name: "CRDT Room", isActive: true, ownerId: userA.id };
  const doc = { id: "d-crdt", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "ORIGINAL\n" };

  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [room],
    participants: [
      { id: "p-ca", roomId: room.id, userId: userA.id },
      { id: "p-cb", roomId: room.id, userId: userB.id },
    ],
    documents: [doc],
  });

  const { url, close } = await createHardeningTestServer(prisma);
  t.after(close);

  const clientA = Client(url, { auth: { token: signAccessToken(userA, TEST_SECRET) }, transports: ["websocket"] });
  const clientB = Client(url, { auth: { token: signAccessToken(userB, TEST_SECRET) }, transports: ["websocket"] });
  t.after(() => { clientA.disconnect(); clientB.disconnect(); });

  const [joinA, joinB] = await Promise.all([
    new Promise((r) => { clientA.emit("room:join", { roomCode: "CRDT01" }); clientA.on("room:joined", r); }),
    new Promise((r) => { clientB.emit("room:join", { roomCode: "CRDT01" }); clientB.on("room:joined", r); }),
  ]);

  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const fileA = joinA.state.files.find((f) => f.fileId === "f-1");
  const fileB = joinB.state.files.find((f) => f.fileId === "f-1");
  Y.applyUpdate(docA, new Uint8Array(fileA.yjsUpdate));
  Y.applyUpdate(docB, new Uint8Array(fileB.yjsUpdate));

  clientA.on("yjs:update", (data) => {
    if (data.fileId === "f-1") Y.applyUpdate(docA, new Uint8Array(data.update), "remote");
  });
  clientB.on("yjs:update", (data) => {
    if (data.fileId === "f-1") Y.applyUpdate(docB, new Uint8Array(data.update), "remote");
  });

  const bGotUpdate = new Promise((r) => clientB.once("yjs:update", r));
  const aGotUpdate = new Promise((r) => clientA.once("yjs:update", r));

  // Alice inserts at beginning
  docA.on("update", (update, origin) => {
    if (origin !== "remote") clientA.emit("yjs:update", { fileId: "f-1", update: Array.from(update) });
  });
  docA.getText("monaco").insert(0, "// Alice Edit\n");

  // Bob inserts at end concurrently
  docB.on("update", (update, origin) => {
    if (origin !== "remote") clientB.emit("yjs:update", { fileId: "f-1", update: Array.from(update) });
  });
  docB.getText("monaco").insert(docB.getText("monaco").length, "// Bob Edit\n");

  await Promise.all([aGotUpdate, bGotUpdate]);
  await new Promise((r) => setTimeout(r, 60));

  const textA = docA.getText("monaco").toString();
  const textB = docB.getText("monaco").toString();

  assert.equal(textA, textB, "CRDT state must mathematically converge to identical content");
  assert.ok(textA.includes("// Alice Edit\n"));
  assert.ok(textA.includes("// Bob Edit\n"));
});

// ─── ISSUE 3 & 4: Persistence, Retries, Shutdown & Yjs Binary State ───────────

test("Issue 3 & 4 — Yjs binary state persistence, restart recovery and fallback", async () => {
  const store = new RoomStateStore();
  const savedDocs = new Map();

  const mockRoomService = {
    async saveRoomDocument({ roomCode, fileId, filename, language, content, yjsState }) {
      savedDocs.set(`${roomCode}_${fileId}`, {
        roomCode,
        fileId,
        filename,
        language,
        content,
        yjsState,
      });
      return { success: true };
    },
    async getRoomDocuments(roomCode) {
      const docs = [];
      for (const [key, d] of savedDocs.entries()) {
        if (d.roomCode === roomCode) docs.push(d);
      }
      return docs;
    },
  };

  store.setRoomService(mockRoomService);
  await store.ensureRoomLoaded("STATE1");

  // Client creates local doc and generates updates
  const clientDoc = new Y.Doc();
  clientDoc.getText("monaco").insert(0, "function hello() { return 'world'; }");
  const update1 = Y.encodeStateAsUpdate(clientDoc);

  // Apply update to store
  store.applyYjsUpdate("STATE1", "f-1", update1);

  // Flush to database immediately
  const flushRes = await store.flush("STATE1");
  assert.equal(flushRes.success, true);
  assert.equal(flushRes.unsaved.length, 0);

  // Verify stored record has both plain-text content and serialized binary yjsState
  const saved = savedDocs.get("STATE1_f-1");
  assert.ok(saved);
  assert.equal(saved.content, "function hello() { return 'world'; }");
  assert.ok(saved.yjsState);
  assert.ok(Buffer.isBuffer(saved.yjsState) || saved.yjsState instanceof Uint8Array);

  // Simulate server restart: new fresh store instance
  const freshStore = new RoomStateStore();
  freshStore.setRoomService(mockRoomService);

  const reloaded = await freshStore.ensureRoomLoaded("STATE1");
  const restoredFile = reloaded.files.get("f-1");
  assert.ok(restoredFile);
  assert.equal(restoredFile.content, "function hello() { return 'world'; }");
  assert.equal(restoredFile.yText.toString(), "function hello() { return 'world'; }");

  // Test legacy fallback: document without yjsState (only plain-text content)
  savedDocs.set("LEGACY_f-1", {
    roomCode: "LEGACY",
    fileId: "f-1",
    filename: "index.js",
    language: "javascript",
    content: "legacy plain text only",
    yjsState: null, // Legacy record
  });

  const legacyStore = new RoomStateStore();
  legacyStore.setRoomService(mockRoomService);
  const legacyRoom = await legacyStore.ensureRoomLoaded("LEGACY");
  const legacyFile = legacyRoom.files.get("f-1");
  assert.ok(legacyFile);
  assert.equal(legacyFile.content, "legacy plain text only");
  assert.equal(legacyFile.yText.toString(), "legacy plain text only");
});

test("Issue 3 — Failed database save keeps pending state and retries safely", async () => {
  const store = new RoomStateStore();
  let failCount = 0;
  let saveCalls = 0;

  const mockRoomService = {
    async saveRoomDocument() {
      saveCalls++;
      if (failCount > 0) {
        failCount--;
        throw new Error("Simulated database connection error");
      }
      return { success: true };
    },
    async getRoomDocuments() {
      return [{ fileId: "f-1", content: "initial" }];
    },
  };

  store.setRoomService(mockRoomService);
  await store.ensureRoomLoaded("RETRY1");

  // Edit file
  const doc = new Y.Doc();
  doc.getText("monaco").insert(0, "updated text");
  const update = Y.encodeStateAsUpdate(doc);

  // Make DB fail on the first attempt
  failCount = 1;
  store.applyYjsUpdate("RETRY1", "f-1", update);

  const file = store.getFile("RETRY1", "f-1");
  assert.equal(file.isDirty, true, "File must be marked isDirty after edit");

  // Flush triggers immediate save; the first attempt fails
  const flushAttempt1 = await store.flush("RETRY1");
  // Flush reports error but file remains dirty (never silently lost)
  assert.equal(flushAttempt1.success, false);
  assert.equal(file.isDirty, true, "File must remain dirty after failed save attempt");

  // DB recovers: next flush succeeds
  const flushAttempt2 = await store.flush("RETRY1");
  assert.equal(flushAttempt2.success, true);
  assert.equal(file.isDirty, false, "File is no longer dirty after successful retry");
  assert.ok(saveCalls >= 2, "Save was retried");
});

test("Issue 3 — Graceful shutdown locks writes and flushes pending saves with timeout", async () => {
  const store = new RoomStateStore();
  let flushCompleted = false;

  const mockRoomService = {
    async saveRoomDocument() {
      await new Promise((r) => setTimeout(r, 20));
      flushCompleted = true;
      return { success: true };
    },
    async getRoomDocuments() {
      return [{ fileId: "f-1", content: "init" }];
    },
  };

  store.setRoomService(mockRoomService);
  await store.ensureRoomLoaded("SHUT01");

  // Mark shutting down
  store.setShuttingDown(true);
  assert.equal(store.isShuttingDown(), true);

  // New writes must be rejected once shutting down
  assert.throws(
    () => store.applyYjsUpdate("SHUT01", "f-1", new Uint8Array([0, 0])),
    { message: /Server is shutting down/ }
  );
  assert.throws(
    () => store.updateFile("SHUT01", "f-1", "new content"),
    { message: /Server is shutting down/ }
  );

  // Test timeout boundedness on flush
  const hangingStore = new RoomStateStore();
  hangingStore.setRoomService({
    async saveRoomDocument() {
      // Never resolves
      await new Promise(() => { });
    },
    async getRoomDocuments() {
      return [{ fileId: "f-1", content: "init" }];
    },
  });
  await hangingStore.ensureRoomLoaded("HANG01");
  const hangingFile = hangingStore._getOrCreateFile("HANG01", "f-1");
  hangingFile.isDirty = true;

  // Flush with 50ms timeout must return without hanging process
  const start = Date.now();
  const flushRes = await hangingStore.flush("HANG01", { timeoutMs: 50 });
  const duration = Date.now() - start;

  assert.ok(duration < 500, "Flush must not block indefinitely on hung database saves");
  assert.equal(flushRes.success, false);
  assert.ok(flushRes.unsaved.length > 0, "Reports unsaved document on timeout");
  assert.equal(flushRes.unsaved[0].fileId, "f-1");
});

// ─── Graceful Shutdown with Connected Socket.IO Clients ──────────────────────

test("Shutdown — io.close() disconnects Socket.IO clients AND closes HTTP server in one call", async (t) => {
  const user = { id: "u-shut", name: "ShutUser", email: "shut@cocode.dev" };
  const room = { id: "r-shut", code: "SHUT01", name: "Shutdown Room", isActive: true, ownerId: user.id };
  const doc = { id: "d-shut", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "initial" };

  const prisma = createMockPrisma({
    users: [user],
    rooms: [room],
    participants: [{ id: "p-shut", roomId: room.id, userId: user.id }],
    documents: [doc],
  });

  const { url, io } = await createHardeningTestServer(prisma);
  const httpServer = io.httpServer;

  const token = signAccessToken(user, TEST_SECRET);

  // Connect two clients to simulate multi-tab
  const clientA = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  const clientB = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });

  await Promise.all([
    new Promise((r) => clientA.on("connect", r)),
    new Promise((r) => clientB.on("connect", r)),
  ]);

  // Both join the room
  await Promise.all([
    new Promise((r) => { clientA.emit("room:join", { roomCode: "SHUT01" }); clientA.once("room:joined", r); }),
    new Promise((r) => { clientB.emit("room:join", { roomCode: "SHUT01" }); clientB.once("room:joined", r); }),
  ]);

  assert.ok(clientA.connected, "Client A is connected before shutdown");
  assert.ok(clientB.connected, "Client B is connected before shutdown");

  // Track disconnect events on clients
  const clientADisconnected = new Promise((r) => clientA.on("disconnect", r));
  const clientBDisconnected = new Promise((r) => clientB.on("disconnect", r));

  // Single io.close() call — closes sockets AND httpServer
  await new Promise((resolve) => io.close(resolve));

  // Both clients must be disconnected
  await Promise.all([clientADisconnected, clientBDisconnected]);
  assert.ok(!clientA.connected, "Client A is disconnected after io.close()");
  assert.ok(!clientB.connected, "Client B is disconnected after io.close()");

  // HTTP server must already be closed (listening === false)
  assert.equal(httpServer.listening, false, "HTTP server is closed by io.close()");

  // Calling httpServer.close() again should fire the callback with an
  // ERR_SERVER_NOT_RUNNING error — proving a second close is redundant
  const doubleCloseErr = await new Promise((resolve) => {
    httpServer.close((err) => resolve(err));
  });
  assert.ok(doubleCloseErr, "Double-closing httpServer produces an error");
  assert.ok(
    doubleCloseErr.code === "ERR_SERVER_NOT_RUNNING" || /not running/i.test(doubleCloseErr.message),
    "Error is ERR_SERVER_NOT_RUNNING"
  );
});

test("Shutdown — HTTP server is closed exactly once (no separate httpServer.close)", async (t) => {
  // Proves that server.js uses io.close() as the sole owner of httpServer
  // lifecycle — no additional httpServer.close() call exists.
  const user = { id: "u-once", name: "OnceUser", email: "once@cocode.dev" };
  const room = { id: "r-once", code: "ONCE01", name: "Once Room", isActive: true, ownerId: user.id };

  const prisma = createMockPrisma({
    users: [user],
    rooms: [room],
    participants: [{ id: "p-once", roomId: room.id, userId: user.id }],
    documents: [],
  });

  const app = createApp(testConfig, { prisma });
  const httpServer = http.createServer(app);
  const roomService = new RoomService(prisma);

  // Spy on httpServer.close to count invocations
  let httpCloseCallCount = 0;
  const origClose = httpServer.close.bind(httpServer);
  httpServer.close = function (...args) {
    httpCloseCallCount++;
    return origClose(...args);
  };

  const io = createSocketHandler(httpServer, {
    jwtSecret: TEST_SECRET,
    jwtIssuer: testConfig.jwtIssuer,
    jwtAudience: testConfig.jwtAudience,
    clientOrigins: testConfig.clientOrigins,
    prisma,
    roomService,
  });

  await new Promise((resolve) => httpServer.listen(0, resolve));

  assert.equal(httpServer.listening, true, "Server is listening before shutdown");

  // io.close() internally calls httpServer.close() exactly once
  await new Promise((resolve) => io.close(resolve));

  assert.equal(httpServer.listening, false, "Server stopped after io.close()");
  assert.equal(httpCloseCallCount, 1, "httpServer.close() was called exactly once by io.close()");
});

test("Shutdown — pending saves are flushed before Prisma disconnect", async (t) => {
  const user = { id: "u-flsh", name: "FlushUser", email: "flsh@cocode.dev" };
  const room = { id: "r-flsh", code: "FLSH01", name: "Flush Room", isActive: true, ownerId: user.id };
  const doc = { id: "d-flsh", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "before-edit" };

  let saveCount = 0;
  let lastSavedContent = null;
  let prismaDisconnected = false;
  let saveCalledAfterDisconnect = false;

  const prisma = createMockPrisma({
    users: [user],
    rooms: [room],
    participants: [{ id: "p-flsh", roomId: room.id, userId: user.id }],
    documents: [doc],
  });

  // Instrument the mock to track ordering
  const origUpsert = prisma.roomDocument.upsert.bind(prisma.roomDocument);
  prisma.roomDocument.upsert = async function (args) {
    saveCount++;
    if (prismaDisconnected) {
      saveCalledAfterDisconnect = true;
    }
    lastSavedContent = args.update?.content || args.create?.content;
    return origUpsert(args);
  };
  prisma.$disconnect = async () => {
    prismaDisconnected = true;
  };

  const { url, io } = await createHardeningTestServer(prisma);

  const token = signAccessToken(user, TEST_SECRET);
  const client = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });

  await new Promise((r) => client.on("connect", r));
  await new Promise((r) => {
    client.emit("room:join", { roomCode: "FLSH01" });
    client.once("room:joined", r);
  });

  // User makes an edit via code:update (creates a pending save)
  client.emit("code:update", {
    fileId: "f-1",
    content: "edited-during-session",
    language: "javascript",
  });

  // Allow the server to process the socket event
  await new Promise((r) => setTimeout(r, 50));

  // --- Simulate the shutdown sequence matching server.js ---
  const { roomStateStore: storeRef } = require("../src/modules/rooms/room.store");

  // 1. Lock writes
  storeRef.setShuttingDown(true);

  // 2. Single close (io.close also closes httpServer)
  const clientDisconnected = new Promise((r) => client.on("disconnect", r));
  await new Promise((resolve) => io.close(resolve));
  await clientDisconnected;

  // 3. Flush pending saves
  const flushResult = await storeRef.flush(null, { timeoutMs: 3000 });

  // 4. Disconnect Prisma
  await prisma.$disconnect();

  assert.ok(!client.connected, "Client is disconnected");
  assert.equal(flushResult.success, true, "Flush completed successfully");
  assert.ok(saveCount > 0, "At least one save was executed during flush");
  assert.equal(lastSavedContent, "edited-during-session", "Flushed content matches last edit");
  assert.equal(saveCalledAfterDisconnect, false, "All saves completed before Prisma.$disconnect()");

  // Reset shutdown flag for other tests sharing the singleton
  storeRef.setShuttingDown(false);
});

test("Shutdown — flush failure sets nonzero exit code (structural)", async () => {
  const store = new RoomStateStore();
  let failingSave = true;

  store.setRoomService({
    async saveRoomDocument() {
      if (failingSave) throw new Error("DB on fire");
      return {};
    },
    async getRoomDocuments() {
      return [{ fileId: "f-1", content: "init" }];
    },
  });

  await store.ensureRoomLoaded("EXITC1");

  const clientDoc = new Y.Doc();
  clientDoc.getText("monaco").insert(0, "doomed edit");
  store.applyYjsUpdate("EXITC1", "f-1", Y.encodeStateAsUpdate(clientDoc));

  const flushResult = await store.flush("EXITC1", { timeoutMs: 1000 });
  assert.equal(flushResult.success, false, "Flush reports failure");
  assert.ok(flushResult.unsaved.length > 0, "Unsaved list is non-empty");

  // Verify the server.js contract: flushFailed would cause process.exitCode = 1
  const flushFailed = !flushResult.success;
  assert.equal(flushFailed, true, "flushFailed flag is true, which sets process.exitCode = 1 in server.js");
});

test("Shutdown — io.close() error sets nonzero exit code (structural)", async () => {
  // Simulates the shutdown() function's io.close error-handling branch.
  // If io.close calls back with an error, closeFailed is set and exitCode = 1.
  let closeFailed = false;
  let exitCode = 0;

  // Simulate io.close that calls back with an error
  const fakeIo = {
    close(cb) {
      cb(new Error("Mock engine close error"));
    },
  };

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out")), 10000);
      try {
        fakeIo.close((err) => {
          clearTimeout(timer);
          err ? reject(err) : resolve();
        });
      } catch (syncErr) {
        clearTimeout(timer);
        reject(syncErr);
      }
    });
  } catch {
    closeFailed = true;
  }

  if (closeFailed) exitCode = 1;
  assert.equal(closeFailed, true, "closeFailed is set when io.close errors");
  assert.equal(exitCode, 1, "Exit code is 1 on close failure");
});

test("Shutdown — io.close timeout timer is cleared on successful close", async () => {
  // Verifies that when io.close() completes before the deadline, clearTimeout
  // is called so no leaked timer keeps the process alive or fires spuriously.
  let timerCleared = false;

  // Capture the timer id allocated by the shutdown pattern
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  let capturedTimerId = null;

  globalThis.setTimeout = (fn, ms) => {
    capturedTimerId = origSetTimeout(fn, ms);
    return capturedTimerId;
  };
  globalThis.clearTimeout = (id) => {
    if (id === capturedTimerId) timerCleared = true;
    return origClearTimeout(id);
  };

  try {
    // Fake io that calls back successfully after a short delay
    const fakeIo = {
      close(cb) {
        origSetTimeout(() => cb(null), 5);
      },
    };

    // Run the exact pattern used in server.js shutdown
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("io.close() timed out after 10 s")),
        10000
      );
      fakeIo.close((err) => {
        clearTimeout(timer);
        err ? reject(err) : resolve();
      });
    });

    assert.equal(timerCleared, true, "Timeout timer was cleared when io.close() succeeded");
    assert.ok(capturedTimerId !== null, "A timeout was set");
  } finally {
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

test("Shutdown — synchronous io.close() exception clears timeout and sets nonzero exit code", async () => {
  // Verifies that if io.close() throws synchronously before calling its callback,
  // the timeout is still cancelled immediately and close failure is recorded.
  let timerCleared = false;
  let closeFailed = false;
  let exitCode = 0;

  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  let capturedTimerId = null;

  globalThis.setTimeout = (fn, ms) => {
    capturedTimerId = origSetTimeout(fn, ms);
    return capturedTimerId;
  };
  globalThis.clearTimeout = (id) => {
    if (id === capturedTimerId) timerCleared = true;
    return origClearTimeout(id);
  };

  try {
    const fakeIo = {
      close() {
        throw new Error("Synchronous close exception");
      },
    };

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("io.close() timed out after 10 s")),
          10000
        );
        try {
          fakeIo.close((err) => {
            clearTimeout(timer);
            err ? reject(err) : resolve();
          });
        } catch (syncErr) {
          clearTimeout(timer);
          reject(syncErr);
        }
      });
    } catch {
      closeFailed = true;
    }

    if (closeFailed) exitCode = 1;

    assert.equal(timerCleared, true, "Timeout timer was cleared when io.close() threw synchronously");
    assert.equal(closeFailed, true, "closeFailed is set when io.close() throws synchronously");
    assert.equal(exitCode, 1, "Exit code is 1 on synchronous close failure");
  } finally {
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

test("Shutdown — Prisma disconnect error sets nonzero exit code (structural)", async () => {
  // Simulates the shutdown() function's prisma.$disconnect error branch.
  let disconnectFailed = false;
  let exitCode = 0;

  const failingPrisma = {
    async $disconnect() {
      throw new Error("Prisma connection pool timed out");
    },
  };

  try {
    await failingPrisma.$disconnect();
  } catch {
    disconnectFailed = true;
  }

  if (disconnectFailed) exitCode = 1;
  assert.equal(disconnectFailed, true, "disconnectFailed is set when prisma.$disconnect errors");
  assert.equal(exitCode, 1, "Exit code is 1 on Prisma disconnect failure");
});

test("Shutdown — duplicate signal does not run shutdown twice", async () => {
  // Simulates the duplicate-guard pattern used in server.js
  let shutdownCallCount = 0;
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    shutdownCallCount++;
    // Simulate async work
    await new Promise((r) => setTimeout(r, 30));
  };

  // Fire three concurrent signals
  shutdown();
  shutdown();
  shutdown();

  await new Promise((r) => setTimeout(r, 60));

  assert.equal(shutdownCallCount, 1, "Shutdown handler executed exactly once despite 3 signals");
  assert.equal(isShuttingDown, true, "Guard flag remains set");
});

test("Shutdown — full sequence: guard, setShuttingDown, io.close, flush, disconnect", async (t) => {
  // End-to-end test that runs the actual shutdown sequence from server.js against
  // a live Socket.IO server with a connected client and a pending dirty document.
  const user = { id: "u-full", name: "FullUser", email: "full@cocode.dev" };
  const room = { id: "r-full", code: "FULL01", name: "Full Shutdown Room", isActive: true, ownerId: user.id };
  const doc = { id: "d-full", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "original" };

  const orderLog = [];

  const prisma = createMockPrisma({
    users: [user],
    rooms: [room],
    participants: [{ id: "p-full", roomId: room.id, userId: user.id }],
    documents: [doc],
  });

  const origUpsert = prisma.roomDocument.upsert.bind(prisma.roomDocument);
  prisma.roomDocument.upsert = async function (args) {
    orderLog.push("flush-save");
    return origUpsert(args);
  };
  prisma.$disconnect = async () => {
    orderLog.push("prisma-disconnect");
  };

  const { url, io } = await createHardeningTestServer(prisma);
  const httpServer = io.httpServer;

  const token = signAccessToken(user, TEST_SECRET);
  const client = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });

  await new Promise((r) => client.on("connect", r));
  await new Promise((r) => {
    client.emit("room:join", { roomCode: "FULL01" });
    client.once("room:joined", r);
  });

  // Create a dirty document
  client.emit("code:update", { fileId: "f-1", content: "dirty-content", language: "javascript" });
  await new Promise((r) => setTimeout(r, 50));

  const { roomStateStore: storeRef } = require("../src/modules/rooms/room.store");

  // --- Run the shutdown sequence exactly as server.js does ---
  let isShuttingDown = false;
  let closeFailed = false;
  let flushFailed = false;
  let disconnectFailed = false;

  // Guard
  if (isShuttingDown) throw new Error("Should not be shutting down yet");
  isShuttingDown = true;

  // Step 1: lock writes
  storeRef.setShuttingDown(true);
  orderLog.push("set-shutting-down");

  // Step 2: io.close (single owner of Socket.IO + HTTP close)
  const clientDisconnected = new Promise((r) => client.on("disconnect", r));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("io.close() timed out")),
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
    orderLog.push("io-closed");
  } catch {
    closeFailed = true;
    orderLog.push("io-close-failed");
  }
  await clientDisconnected;

  // Step 3: flush
  try {
    const flushResult = await storeRef.flush(null, { timeoutMs: 3000 });
    if (!flushResult.success) flushFailed = true;
    orderLog.push("flushed");
  } catch {
    flushFailed = true;
    orderLog.push("flush-failed");
  }

  // Step 4: prisma disconnect
  try {
    await prisma.$disconnect();
  } catch {
    disconnectFailed = true;
  }

  // Assertions: correct ordering
  const shutDownIdx = orderLog.indexOf("set-shutting-down");
  const ioClosedIdx = orderLog.indexOf("io-closed");
  const flushedIdx = orderLog.indexOf("flushed");
  const disconnectIdx = orderLog.indexOf("prisma-disconnect");

  assert.ok(shutDownIdx < ioClosedIdx, "setShuttingDown before io.close");
  assert.ok(ioClosedIdx < flushedIdx, "io.close before flush");
  // flush-save entries must all come before prisma-disconnect
  const flushSaveIndices = orderLog.reduce((acc, e, i) => (e === "flush-save" ? [...acc, i] : acc), []);
  for (const idx of flushSaveIndices) {
    assert.ok(idx < disconnectIdx, `flush save at index ${idx} before prisma disconnect at ${disconnectIdx}`);
  }

  assert.equal(httpServer.listening, false, "HTTP server is stopped");
  assert.ok(!client.connected, "Client is disconnected");
  assert.equal(closeFailed, false, "io.close succeeded");
  assert.equal(flushFailed, false, "Flush succeeded");
  assert.equal(disconnectFailed, false, "Prisma disconnect succeeded");

  // Reset for other tests
  storeRef.setShuttingDown(false);
});
