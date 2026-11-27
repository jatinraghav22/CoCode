"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { io: Client } = require("socket.io-client");
const { createSocketHandler } = require("../src/socket");
const { signAccessToken } = require("../src/utils/jwt");
const { RoomService } = require("../src/modules/rooms/room.service");
const { roomStateStore } = require("../src/modules/rooms/room.store");
const {
  validateWhiteboardElement,
  isValidElementId,
} = require("../src/modules/rooms/whiteboard.validation");

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

function createMockPrisma({ users = [], rooms = [], participants = [], documents = [] } = {}) {
  const userMap = new Map(users.map((u) => [u.id, { ...u }]));
  const roomMap = new Map(rooms.map((r) => [r.id, { ...r, code: r.code.toUpperCase() }]));
  const participantMap = new Map(participants.map((p) => [p.id, { ...p }]));
  const documentMap = new Map(documents.map((d) => [d.id, { ...d }]));

  return {
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
      async findUnique({ where, select }) {
        let found = null;
        if (where.id) found = roomMap.get(where.id) || null;
        else if (where.code) {
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
                  if (!select.participants.where?.userId || p.userId === select.participants.where.userId) {
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
        return { ...found };
      },
    },
    roomDocument: {
      async findMany({ where }) {
        const list = [];
        for (const d of documentMap.values()) {
          if (d.roomId === where.roomId) list.push({ ...d });
        }
        return list;
      },
    },
  };
}

function makeToken(userId, name) {
  return signAccessToken(
    { id: userId, name, email: `${userId}@cocode.dev` },
    TEST_SECRET,
    { expiresIn: "1h", issuer: testConfig.jwtIssuer, audience: testConfig.jwtAudience }
  );
}

// ─── Unit Tests: Whiteboard Validation ───────────────────────────────────────

test("Whiteboard validation — accepts valid pencil, shape, and text elements and stamps server author", () => {
  const pencil = validateWhiteboardElement(
    {
      id: "wb-stroke-1",
      type: "pencil",
      color: "#38bdf8",
      strokeWidth: 4,
      points: [{ x: 10, y: 20 }, { x: 50, y: 60 }],
      authorId: "spoofed-user",
    },
    { userId: "real-user-1", userName: "Alice" }
  );
  assert.equal(pencil.valid, true);
  assert.equal(pencil.element.authorId, "real-user-1");
  assert.equal(pencil.element.authorName, "Alice");

  const arrow = validateWhiteboardElement(
    { id: "wb-arrow-1", type: "arrow", color: "#fbbf24", strokeWidth: 3, x1: 0, y1: 0, x2: 100, y2: 100 },
    { userId: "real-user-1", userName: "Alice" }
  );
  assert.equal(arrow.valid, true);

  const text = validateWhiteboardElement(
    { id: "wb-text-1", type: "text", color: "#f8fafc", strokeWidth: 2, x: 120, y: 240, text: "Architecture", fontSize: 22 },
    { userId: "real-user-1", userName: "Alice" }
  );
  assert.equal(text.valid, true);
  assert.equal(text.element.text, "Architecture");
});

test("Whiteboard validation — rejects malformed payloads, unknown types, and invalid coordinates", () => {
  assert.equal(validateWhiteboardElement(null).valid, false);
  assert.equal(validateWhiteboardElement({ id: "bad", type: "script", color: "#fff", strokeWidth: 2 }).valid, false);
  assert.equal(validateWhiteboardElement({ id: "wb-1", type: "pencil", color: "#fff", strokeWidth: 2, points: [] }).valid, false);
  assert.equal(validateWhiteboardElement({ id: "wb-1", type: "rect", color: "#fff", strokeWidth: 2, x1: NaN, y1: 0, x2: 10, y2: 10 }).valid, false);
  assert.equal(validateWhiteboardElement({ id: "wb-1", type: "text", color: "#fff", strokeWidth: 2, x: 10, y: 10, text: "   " }).valid, false);
  assert.equal(isValidElementId("x"), false);
  assert.equal(isValidElementId("wb-valid-123"), true);
});

// ─── Integration Tests: Real-Time Socket.IO Whiteboard ────────────────────────

test("Whiteboard Socket.IO — real-time sync, late joiner hydration, room isolation, and auth rejection", async () => {
  const users = [
    { id: "wb-u1", name: "Alice" },
    { id: "wb-u2", name: "Bob" },
    { id: "wb-u3", name: "Eve" },
  ];
  const rooms = [
    { id: "wb-r1", code: "WBRM01", name: "Room One", ownerId: "wb-u1", isActive: true },
    { id: "wb-r2", code: "WBRM02", name: "Room Two", ownerId: "wb-u3", isActive: true },
  ];
  const participants = [
    { id: "wb-p1", roomId: "wb-r1", userId: "wb-u1" },
    { id: "wb-p2", roomId: "wb-r1", userId: "wb-u2" },
    { id: "wb-p3", roomId: "wb-r2", userId: "wb-u3" },
  ];
  const documents = [
    { id: "wb-d1", roomId: "wb-r1", fileId: "f-1", filename: "index.js", language: "javascript", content: "console.log(1);" },
  ];

  const prisma = createMockPrisma({ users, rooms, participants, documents });
  const roomService = new RoomService(prisma);
  const httpServer = http.createServer();
  const io = createSocketHandler(httpServer, { ...testConfig, prisma, roomService });

  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const clientA = Client(baseUrl, { auth: { token: makeToken("wb-u1", "Alice") }, transports: ["websocket"], reconnection: false });
  const clientB = Client(baseUrl, { auth: { token: makeToken("wb-u2", "Bob") }, transports: ["websocket"], reconnection: false });
  const clientEve = Client(baseUrl, { auth: { token: makeToken("wb-u3", "Eve") }, transports: ["websocket"], reconnection: false });

  try {
    await Promise.all([
      new Promise((r) => clientA.once("connect", r)),
      new Promise((r) => clientB.once("connect", r)),
      new Promise((r) => clientEve.once("connect", r)),
    ]);

    // 1. Alice joins WBRM01 and Eve joins WBRM02
    const joinA = new Promise((r) => clientA.once("whiteboard:state", r));
    const joinEve = new Promise((r) => clientEve.once("whiteboard:state", r));
    clientA.emit("room:join", { roomCode: "WBRM01" });
    clientEve.emit("room:join", { roomCode: "WBRM02" });
    await Promise.all([joinA, joinEve]);

    // 2. Unauthorized check: Bob (not yet in a room) cannot draw
    const unauthErrPromise = new Promise((r) => clientB.once("whiteboard:error", r));
    clientB.emit("whiteboard:element:add", {
      element: { id: "wb-unauth-1", type: "rect", color: "#fff", strokeWidth: 2, x1: 10, y1: 10, x2: 50, y2: 50 },
    });
    const unauthErr = await unauthErrPromise;
    assert.match(unauthErr.message, /not in a room/i);

    // 3. Alice adds an element in WBRM01; Eve in WBRM02 must NOT receive it
    let eveReceived = false;
    clientEve.on("whiteboard:element:add", () => {
      eveReceived = true;
    });

    clientA.emit("whiteboard:element:add", {
      element: {
        id: "wb-rect-1",
        type: "rect",
        color: "#38bdf8",
        strokeWidth: 4,
        x1: 100,
        y1: 100,
        x2: 260,
        y2: 200,
      },
    });

    // Wait briefly for server to process
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(eveReceived, false, "Room B must never receive Room A whiteboard events");

    // 4. Bob joins WBRM01 late and receives Alice's existing element
    const bobStatePromise = new Promise((r) => clientB.once("whiteboard:state", r));
    clientB.emit("room:join", { roomCode: "WBRM01" });
    const bobState = await bobStatePromise;
    assert.equal(bobState.roomCode, "WBRM01");
    assert.equal(bobState.elements.length, 1);
    assert.equal(bobState.elements[0].id, "wb-rect-1");
    assert.equal(bobState.elements[0].authorId, "wb-u1");

    // 5. Alice updates element and Bob receives it in real time
    const bobUpdatePromise = new Promise((r) => clientB.once("whiteboard:element:update", r));
    clientA.emit("whiteboard:element:update", {
      element: {
        id: "wb-rect-1",
        type: "rect",
        color: "#38bdf8",
        strokeWidth: 4,
        x1: 150,
        y1: 150,
        x2: 310,
        y2: 250,
      },
    });
    const bobUpdate = await bobUpdatePromise;
    assert.equal(bobUpdate.element.x1, 150);

    // 6. Code editor documents remain completely untouched by whiteboard activity
    const roomSnapshot = roomStateStore.getRoomSnapshot("WBRM01");
    assert.equal(roomSnapshot.files.length, 1);
    assert.equal(roomSnapshot.files[0].content, "console.log(1);");

    // 7. Alice clears whiteboard and Bob receives whiteboard:clear
    const bobClearPromise = new Promise((r) => clientB.once("whiteboard:clear", r));
    clientA.emit("whiteboard:clear");
    await bobClearPromise;
    assert.equal(roomStateStore.getWhiteboardElements("WBRM01").length, 0);
  } finally {
    clientA.disconnect();
    clientB.disconnect();
    clientEve.disconnect();
    await new Promise((resolve) => {
      io.close(() => {
        httpServer.close(resolve);
      });
    });
  }
});
