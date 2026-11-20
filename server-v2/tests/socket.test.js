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
const { roomStateStore, RoomStateStore } = require("../src/modules/rooms/room.store");

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
 * Creates an in-memory mock Prisma client for socket tests.
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
 * Creates an ephemeral test HTTP server with Express app and Socket.IO handler attached.
 */
async function createSocketTestServer(prisma) {
  const app = createApp(testConfig, { prisma });
  const httpServer = http.createServer(app);

  const roomService = new RoomService(prisma);
  const io = createSocketHandler(httpServer, {
    jwtSecret: testConfig.jwtSecret,
    jwtIssuer: testConfig.jwtIssuer,
    jwtAudience: testConfig.jwtAudience,
    clientOrigins: testConfig.clientOrigins,
    prisma,
    roomService,
  });

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  const url = `http://127.0.0.1:${port}`;

  const close = () =>
    new Promise((resolve) => {
      io.close(() => {
        httpServer.close(resolve);
      });
    });

  return { url, close, io, roomService };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test("Socket.IO - valid JWT token successfully connects", async (t) => {
  const user = { id: "u-1", name: "Alice", email: "alice@cocode.dev" };
  const prisma = createMockPrisma({ users: [user] });
  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);

  const client = Client(url, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
  t.after(() => client.disconnect());

  await new Promise((resolve, reject) => {
    client.on("connect", resolve);
    client.on("connect_error", reject);
  });

  assert.equal(client.connected, true);
});

test("Socket.IO - missing JWT token is rejected with connect_error", async (t) => {
  const prisma = createMockPrisma();
  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const client = Client(url, {
    auth: {},
    transports: ["websocket"],
    reconnection: false,
  });
  t.after(() => client.disconnect());

  const err = await new Promise((resolve) => {
    client.on("connect_error", resolve);
  });

  assert.match(err.message, /token is required/i);
  assert.equal(client.connected, false);
});

test("Socket.IO - invalid JWT signature is rejected with connect_error", async (t) => {
  const prisma = createMockPrisma();
  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const client = Client(url, {
    auth: { token: "this.is.a.forged.token" },
    transports: ["websocket"],
    reconnection: false,
  });
  t.after(() => client.disconnect());

  const err = await new Promise((resolve) => {
    client.on("connect_error", resolve);
  });

  assert.match(err.message, /invalid/i);
  assert.equal(client.connected, false);
});

test("Socket.IO - room:join delivers initial persistent snapshot with Yjs update and presence", async (t) => {
  const user = { id: "u-owner", name: "Owner Alice", email: "owner@cocode.dev" };
  const room = { id: "r-1", code: "CODE01", name: "Alpha", isActive: true, ownerId: user.id };
  const doc = { id: "d-1", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "console.log('hi');" };
  const prisma = createMockPrisma({
    users: [user],
    rooms: [room],
    participants: [{ id: "p-1", roomId: room.id, userId: user.id }],
    documents: [doc],
  });
  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const client = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  t.after(() => client.disconnect());

  await new Promise((resolve) => client.on("connect", resolve));

  const joinResult = await new Promise((resolve) => {
    client.emit("room:join", { roomCode: "CODE01" });
    client.on("room:joined", resolve);
  });

  assert.equal(joinResult.roomCode, "CODE01");
  assert.ok(Array.isArray(joinResult.presence));
  assert.equal(joinResult.presence.length, 1);
  assert.equal(joinResult.presence[0].userId, user.id);

  // Check persistent snapshot delivery
  assert.ok(joinResult.state);
  assert.ok(Array.isArray(joinResult.state.files));
  const file1 = joinResult.state.files.find((f) => f.fileId === "f-1");
  assert.ok(file1);
  assert.equal(file1.content, "console.log('hi');");
  assert.ok(Array.isArray(file1.yjsUpdate));
});

test("Socket.IO - unauthorized user cannot join arbitrary room", async (t) => {
  const owner = { id: "u-owner", name: "Owner", email: "owner@cocode.dev" };
  const intruder = { id: "u-intruder", name: "Intruder", email: "intruder@cocode.dev" };
  const room = { id: "r-priv", code: "PRIV01", name: "Private", isActive: true, ownerId: owner.id };
  const prisma = createMockPrisma({
    users: [owner, intruder],
    rooms: [room],
    participants: [{ id: "p-1", roomId: room.id, userId: owner.id }],
  });
  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const token = signAccessToken(intruder, TEST_SECRET);
  const client = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  t.after(() => client.disconnect());

  await new Promise((resolve) => client.on("connect", resolve));

  const errorResult = await new Promise((resolve) => {
    client.emit("room:join", { roomCode: "PRIV01" });
    client.on("room:error", resolve);
  });

  assert.match(errorResult.message, /not a participant/i);
});

test("Socket.IO - Yjs simultaneous editing converges without merge conflicts", async (t) => {
  const userA = { id: "u-yjs-a", name: "User A", email: "a@cocode.dev" };
  const userB = { id: "u-yjs-b", name: "User B", email: "b@cocode.dev" };
  const room = { id: "r-yjs", code: "YJS001", name: "Yjs Room", isActive: true, ownerId: userA.id };
  const doc = { id: "d-yjs", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "LINE1\n" };
  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [room],
    participants: [
      { id: "p-a", roomId: room.id, userId: userA.id },
      { id: "p-b", roomId: room.id, userId: userB.id },
    ],
    documents: [doc],
  });
  const { url, close } = await createSocketTestServer(prisma);
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

  // Client local Yjs documents
  const clientDocA = new Y.Doc();
  const clientDocB = new Y.Doc();

  // Join room and initialize local Y.Docs from server snapshot
  const [joinA, joinB] = await Promise.all([
    new Promise((r) => {
      clientA.emit("room:join", { roomCode: "YJS001" });
      clientA.on("room:joined", r);
    }),
    new Promise((r) => {
      clientB.emit("room:join", { roomCode: "YJS001" });
      clientB.on("room:joined", r);
    }),
  ]);

  const fileA = joinA.state.files.find((f) => f.fileId === "f-1");
  const fileB = joinB.state.files.find((f) => f.fileId === "f-1");
  Y.applyUpdate(clientDocA, new Uint8Array(fileA.yjsUpdate));
  Y.applyUpdate(clientDocB, new Uint8Array(fileB.yjsUpdate));

  assert.equal(clientDocA.getText("monaco").toString(), "LINE1\n");
  assert.equal(clientDocB.getText("monaco").toString(), "LINE1\n");

  // Wire incoming updates to local Y.Doc
  clientA.on("yjs:update", (data) => {
    if (data.fileId === "f-1") {
      Y.applyUpdate(clientDocA, new Uint8Array(data.update), "remote");
    }
  });

  clientB.on("yjs:update", (data) => {
    if (data.fileId === "f-1") {
      Y.applyUpdate(clientDocB, new Uint8Array(data.update), "remote");
    }
  });

  // Client A and Client B edit SIMULTANEOUSLY at different positions
  const bReceivedPromise = new Promise((resolve) => {
    clientB.once("yjs:update", resolve);
  });
  const aReceivedPromise = new Promise((resolve) => {
    clientA.once("yjs:update", resolve);
  });

  // Client A inserts at the start
  clientDocA.on("update", (update, origin) => {
    if (origin !== "remote") {
      clientA.emit("yjs:update", { fileId: "f-1", update: Array.from(update) });
    }
  });
  clientDocA.getText("monaco").insert(0, "// By Alice\n");

  // Client B inserts at the end
  clientDocB.on("update", (update, origin) => {
    if (origin !== "remote") {
      clientB.emit("yjs:update", { fileId: "f-1", update: Array.from(update) });
    }
  });
  clientDocB.getText("monaco").insert(clientDocB.getText("monaco").length, "// By Bob\n");

  // Wait for both updates to be received across the socket
  await Promise.all([aReceivedPromise, bReceivedPromise]);

  // Give 50ms for CRDT transactions to settle
  await new Promise((r) => setTimeout(r, 50));

  const textA = clientDocA.getText("monaco").toString();
  const textB = clientDocB.getText("monaco").toString();

  // Both local documents must converge to the EXACT same text string
  assert.equal(textA, textB, "Concurrent Yjs edits must mathematically converge to identical content");
  assert.ok(textA.includes("// By Alice\n"));
  assert.ok(textA.includes("// By Bob\n"));

  // Check server-side document state also matches
  const serverSnapshot = roomStateStore.getRoomSnapshot("YJS001");
  const serverFile = serverSnapshot.files.find((f) => f.fileId === "f-1");
  assert.equal(serverFile.content, textA);
});

test("Socket.IO - persistence and backend restart recovery", async (t) => {
  const user = { id: "u-persist", name: "Persist User", email: "p@cocode.dev" };
  const room = { id: "r-restart", code: "REST01", name: "Restart Room", isActive: true, ownerId: user.id };
  const doc = { id: "d-rest", roomId: room.id, fileId: "f-1", filename: "index.js", language: "javascript", content: "initial" };
  const prisma = createMockPrisma({
    users: [user],
    rooms: [room],
    participants: [{ id: "p-1", roomId: room.id, userId: user.id }],
    documents: [doc],
  });
  const { url, close, roomService } = await createSocketTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const client = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  t.after(() => client.disconnect());

  await new Promise((r) => client.on("connect", r));
  await new Promise((r) => {
    client.emit("room:join", { roomCode: "REST01" });
    client.on("room:joined", r);
  });

  // User edits file
  client.emit("code:update", {
    fileId: "f-1",
    content: "persisted content after edits",
    language: "javascript",
  });

  await new Promise((r) => setTimeout(r, 50));

  // Flush to mock database (simulating shutdown flush)
  await roomStateStore.flush("REST01");

  // Verify mock DB record was updated
  let dbDoc = null;
  for (const d of prisma._documents.values()) {
    if (d.roomId === room.id && d.fileId === "f-1") {
      dbDoc = d;
      break;
    }
  }
  assert.ok(dbDoc);
  assert.equal(dbDoc.content, "persisted content after edits");

  // Simulate a fresh backend instance (new RoomStateStore with empty memory)
  const freshStore = new RoomStateStore();
  freshStore.setRoomService(roomService);

  // Load room on the fresh backend instance
  await freshStore.ensureRoomLoaded("REST01", roomService);
  const freshSnapshot = freshStore.getRoomSnapshot("REST01");
  const restoredFile = freshSnapshot.files.find((f) => f.fileId === "f-1");

  assert.ok(restoredFile, "Document should be restored from TiDB on fresh server");
  assert.equal(restoredFile.content, "persisted content after edits", "Persistent content restored accurately");
});

test("Socket.IO - multi-tab presence: user:left is not emitted if another tab remains", async (t) => {
  const userA = { id: "u-tab-a", name: "User A", email: "a@cocode.dev" };
  const userB = { id: "u-tab-b", name: "User B", email: "b@cocode.dev" };
  const room = { id: "r-tabs", code: "TABS01", name: "Tabs Room", isActive: true, ownerId: userA.id };
  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [room],
    participants: [
      { id: "p-a", roomId: room.id, userId: userA.id },
      { id: "p-b", roomId: room.id, userId: userB.id },
    ],
  });
  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const tokenA = signAccessToken(userA, TEST_SECRET);
  const tokenB = signAccessToken(userB, TEST_SECRET);

  const clientA = Client(url, { auth: { token: tokenA }, transports: ["websocket"], reconnection: false });
  t.after(() => clientA.disconnect());
  await new Promise((r) => clientA.on("connect", r));
  await new Promise((r) => {
    clientA.emit("room:join", { roomCode: "TABS01" });
    clientA.on("room:joined", r);
  });

  const tab1 = Client(url, { auth: { token: tokenB }, transports: ["websocket"], reconnection: false });
  await new Promise((r) => tab1.on("connect", r));
  await new Promise((r) => {
    tab1.emit("room:join", { roomCode: "TABS01" });
    tab1.on("room:joined", r);
  });

  const tab2 = Client(url, { auth: { token: tokenB }, transports: ["websocket"], reconnection: false });
  t.after(() => tab2.disconnect());
  await new Promise((r) => tab2.on("connect", r));
  await new Promise((r) => {
    tab2.emit("room:join", { roomCode: "TABS01" });
    tab2.on("room:joined", r);
  });

  let userBLeftEmitted = false;
  clientA.on("user:left", (data) => {
    if (data.userId === userB.id) userBLeftEmitted = true;
  });

  tab1.disconnect();
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(userBLeftEmitted, false, "Multi-tab disconnect should not mark user offline while another tab is active");
});

test("Socket.IO - room switching cleanly leaves previous room and updates presence", async (t) => {
  const user = { id: "u-switch", name: "Switcher", email: "switch@cocode.dev" };
  const room1 = { id: "r-1", code: "SWTC01", name: "Room 1", isActive: true, ownerId: user.id };
  const room2 = { id: "r-2", code: "SWTC02", name: "Room 2", isActive: true, ownerId: user.id };
  const prisma = createMockPrisma({
    users: [user],
    rooms: [room1, room2],
    participants: [
      { id: "p-1", roomId: room1.id, userId: user.id },
      { id: "p-2", roomId: room2.id, userId: user.id },
    ],
  });
  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const client = Client(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  t.after(() => client.disconnect());

  await new Promise((r) => client.on("connect", r));

  // Join Room 1
  await new Promise((r) => {
    client.emit("room:join", { roomCode: "SWTC01" });
    client.on("room:joined", r);
  });
  assert.equal(roomStateStore.getPresence("SWTC01").length, 1);

  // Switch to Room 2 on the same socket
  await new Promise((r) => {
    client.emit("room:join", { roomCode: "SWTC02" });
    client.once("room:joined", r);
  });

  // Room 1 should now be empty and Room 2 should have 1 active user
  assert.equal(roomStateStore.getPresence("SWTC01").length, 0);
  assert.equal(roomStateStore.getPresence("SWTC02").length, 1);
});

test("Socket.IO - chat:message broadcasts to room with safe user projections", async (t) => {
  const userA = { id: "u-chat-a", name: "Chatter A", email: "a@cocode.dev" };
  const userB = { id: "u-chat-b", name: "Chatter B", email: "b@cocode.dev" };
  const room = { id: "r-chat", code: "CHAT01", name: "Chat Room", isActive: true, ownerId: userA.id };
  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [room],
    participants: [
      { id: "p-a", roomId: room.id, userId: userA.id },
      { id: "p-b", roomId: room.id, userId: userB.id },
    ],
  });
  const { url, close } = await createSocketTestServer(prisma);
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
      clientA.emit("room:join", { roomCode: "CHAT01" });
      clientA.on("room:joined", r);
    }),
    new Promise((r) => {
      clientB.emit("room:join", { roomCode: "CHAT01" });
      clientB.on("room:joined", r);
    }),
  ]);

  const bChatPromise = new Promise((resolve) => {
    clientB.on("chat:message", resolve);
  });

  clientA.emit("chat:message", { text: "Hello from Alice!" });

  const chatMsg = await bChatPromise;
  assert.equal(chatMsg.text, "Hello from Alice!");
  assert.equal(chatMsg.senderId, userA.id);
  assert.equal(chatMsg.senderName, userA.name);
  assert.equal(chatMsg.email, undefined);
  assert.equal(chatMsg.password, undefined);
});

test("Socket.IO - chat delivery: sender and peer receive exactly one copy with consistent ID", async (t) => {
  const userA = { id: "u-ch1", name: "Sender One", email: "s1@cocode.dev" };
  const userB = { id: "u-ch2", name: "Receiver Two", email: "r2@cocode.dev" };
  const room = { id: "r-chdup", code: "CHDD01", name: "Chat Dedup Room", isActive: true, ownerId: userA.id };

  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [room],
    participants: [
      { id: "p-ch1", roomId: room.id, userId: userA.id },
      { id: "p-ch2", roomId: room.id, userId: userB.id },
    ],
  });

  const { url, close } = await createSocketTestServer(prisma);
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
      clientA.emit("room:join", { roomCode: "CHDD01" });
      clientA.once("room:joined", r);
    }),
    new Promise((r) => {
      clientB.emit("room:join", { roomCode: "CHDD01" });
      clientB.once("room:joined", r);
    }),
  ]);

  // Client message list replicating frontend reconciliation logic
  const clientAMessages = [];
  const clientBMessages = [];

  const handleMessage = (list, msg) => {
    if (!msg || !msg.id) return;
    const existingIdx = list.findIndex((m) => m.id === msg.id);
    if (existingIdx !== -1) {
      list[existingIdx] = { ...list[existingIdx], ...msg, optimistic: false };
      return;
    }
    const optIdx = list.findIndex((m) => m.optimistic && m.text === msg.text);
    if (optIdx !== -1) {
      list[optIdx] = { ...msg, optimistic: false };
      return;
    }
    list.push(msg);
  };

  clientA.on("chat:message", (msg) => handleMessage(clientAMessages, msg));
  clientA.on("chat-message", (msg) => handleMessage(clientAMessages, msg));
  clientB.on("chat:message", (msg) => handleMessage(clientBMessages, msg));
  clientB.on("chat-message", (msg) => handleMessage(clientBMessages, msg));

  // Client A sends message optimistically
  const clientMessageId = `msg-client-${Date.now()}`;
  const optimisticMsg = {
    id: clientMessageId,
    senderId: userA.id,
    senderName: userA.name,
    text: "Hello from Client A!",
    timestamp: "12:00 PM",
    optimistic: true,
  };
  clientAMessages.push(optimisticMsg);

  // Emit to server with consistent message ID
  clientA.emit("chat-message", {
    roomCode: "CHDD01",
    id: clientMessageId,
    text: optimisticMsg.text,
    message: optimisticMsg,
  });

  // Wait for socket broadcast
  await new Promise((r) => setTimeout(r, 60));

  // Sender A receives exactly 1 copy (optimistic message reconciled, no duplicate)
  assert.equal(clientAMessages.length, 1, "Sender A has exactly one copy of the message");
  assert.equal(clientAMessages[0].id, clientMessageId);
  assert.equal(clientAMessages[0].optimistic, false);

  // Receiver B receives exactly 1 copy
  assert.equal(clientBMessages.length, 1, "Receiver B has exactly one copy of the message");
  assert.equal(clientBMessages[0].id, clientMessageId);
  assert.equal(clientBMessages[0].text, "Hello from Client A!");
});

test("Socket.IO - chat ordering: multiple messages appear in the correct chronological order", async (t) => {
  const userA = { id: "u-ord1", name: "User One", email: "o1@cocode.dev" };
  const userB = { id: "u-ord2", name: "User Two", email: "o2@cocode.dev" };
  const room = { id: "r-ord", code: "CORD01", name: "Order Room", isActive: true, ownerId: userA.id };

  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [room],
    participants: [
      { id: "p-o1", roomId: room.id, userId: userA.id },
      { id: "p-o2", roomId: room.id, userId: userB.id },
    ],
  });

  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const clientA = Client(url, { auth: { token: signAccessToken(userA, TEST_SECRET) }, transports: ["websocket"], reconnection: false });
  const clientB = Client(url, { auth: { token: signAccessToken(userB, TEST_SECRET) }, transports: ["websocket"], reconnection: false });
  t.after(() => { clientA.disconnect(); clientB.disconnect(); });

  await Promise.all([
    new Promise((r) => clientA.on("connect", r)),
    new Promise((r) => clientB.on("connect", r)),
  ]);

  await Promise.all([
    new Promise((r) => { clientA.emit("room:join", { roomCode: "CORD01" }); clientA.once("room:joined", r); }),
    new Promise((r) => { clientB.emit("room:join", { roomCode: "CORD01" }); clientB.once("room:joined", r); }),
  ]);

  const receivedByB = [];
  clientB.on("chat:message", (msg) => {
    receivedByB.push(msg.text);
  });

  // Send 3 sequential messages
  clientA.emit("chat:message", { text: "First message" });
  await new Promise((r) => setTimeout(r, 20));
  clientA.emit("chat:message", { text: "Second message" });
  await new Promise((r) => setTimeout(r, 20));
  clientA.emit("chat:message", { text: "Third message" });

  await new Promise((r) => setTimeout(r, 60));

  assert.equal(receivedByB.length, 3);
  assert.deepEqual(receivedByB, ["First message", "Second message", "Third message"]);
});

test("Socket.IO - chat deduplication: repeated event delivery does not create duplicate messages", async (t) => {
  const user = { id: "u-rep", name: "Repeater", email: "rep@cocode.dev" };
  const room = { id: "r-rep", code: "CREP01", name: "Repeater Room", isActive: true, ownerId: user.id };

  const prisma = createMockPrisma({
    users: [user],
    rooms: [room],
    participants: [{ id: "p-rep", roomId: room.id, userId: user.id }],
  });

  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const client = Client(url, { auth: { token: signAccessToken(user, TEST_SECRET) }, transports: ["websocket"], reconnection: false });
  t.after(() => client.disconnect());

  await new Promise((r) => client.on("connect", r));
  await new Promise((r) => { client.emit("room:join", { roomCode: "CREP01" }); client.once("room:joined", r); });

  const messages = [];
  const handleMessage = (msg) => {
    const idx = messages.findIndex((m) => m.id === msg.id);
    if (idx !== -1) {
      messages[idx] = { ...messages[idx], ...msg };
    } else {
      messages.push(msg);
    }
  };

  // Listen to both events
  client.on("chat:message", handleMessage);
  client.on("chat-message", handleMessage);

  const stableId = "msg-fixed-12345";
  // Emit chat-message (which causes server to broadcast both chat:message AND chat-message)
  client.emit("chat-message", {
    roomCode: "CREP01",
    id: stableId,
    text: "Repeated test message",
  });

  await new Promise((r) => setTimeout(r, 60));

  // Despite server emitting both chat:message and chat-message, messages has length 1
  assert.equal(messages.length, 1, "Exactly one message remains after dual broadcast");
  assert.equal(messages[0].id, stableId);
  assert.equal(messages[0].text, "Repeated test message");
});

test("Socket.IO - chat room authorization: unjoined socket cannot broadcast chat messages", async (t) => {
  const user = { id: "u-unauth", name: "Unauth Chat", email: "unauth@cocode.dev" };
  const prisma = createMockPrisma({ users: [user] });

  const { url, close } = await createSocketTestServer(prisma);
  t.after(close);

  const client = Client(url, { auth: { token: signAccessToken(user, TEST_SECRET) }, transports: ["websocket"], reconnection: false });
  t.after(() => client.disconnect());

  await new Promise((r) => client.on("connect", r));

  let chatReceived = false;
  client.on("chat:message", () => { chatReceived = true; });

  // Emitting chat without joining any room
  client.emit("chat:message", { text: "Sneaky chat" });

  await new Promise((r) => setTimeout(r, 60));
  assert.equal(chatReceived, false, "Chat was not broadcast since socket has no currentRoom");
});
