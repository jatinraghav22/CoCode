"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { signAccessToken } = require("../src/utils/jwt");
const { RoomService, generateRoomCode, DEFAULT_ROOM_DOCUMENTS } = require("../src/modules/rooms/room.service");

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
 * Creates an in-memory mock Prisma client supporting user, collaborationRoom,
 * roomParticipant, and roomDocument models.
 */
function createMockPrisma({ users = [], rooms = [], participants = [], documents = [] } = {}) {
  const userMap = new Map();
  const roomMap = new Map();
  const participantMap = new Map();
  const documentMap = new Map();
  let idCounter = 1;

  for (const u of users) {
    userMap.set(u.id, { ...u });
  }

  for (const r of rooms) {
    roomMap.set(r.id, {
      ...r,
      code: r.code.toUpperCase(),
      createdAt: r.createdAt || new Date(),
      updatedAt: r.updatedAt || new Date(),
    });
  }

  for (const p of participants) {
    participantMap.set(p.id, { ...p });
  }

  for (const d of documents) {
    documentMap.set(d.id, { ...d });
  }

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
          for (const k of Object.keys(select)) {
            if (select[k]) res[k] = u[k];
          }
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
                if (d.roomId === found.id) {
                  matched.push({ ...d });
                }
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
            res.owner = owner
              ? { id: owner.id, name: owner.name, email: owner.email }
              : null;
          }
          if (include.participants) {
            const parts = [];
            for (const p of participantMap.values()) {
              if (p.roomId === found.id) {
                const u = userMap.get(p.userId);
                parts.push({
                  ...p,
                  user: u ? { id: u.id, name: u.name, email: u.email } : null,
                });
              }
            }
            res.participants = parts;
          }
          if (include.documents) {
            const docs = [];
            for (const d of documentMap.values()) {
              if (d.roomId === found.id) {
                docs.push({ ...d });
              }
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        roomMap.set(id, newRoom);

        // Auto-create initial participant if provided in nested create
        if (data.participants?.create) {
          const pData = data.participants.create;
          const pid = `part_${idCounter++}`;
          participantMap.set(pid, {
            id: pid,
            roomId: id,
            userId: pData.userId,
            joinedAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Auto-create initial documents if provided in nested create
        if (data.documents?.create && Array.isArray(data.documents.create)) {
          for (const doc of data.documents.create) {
            const did = `doc_${idCounter++}`;
            documentMap.set(did, {
              id: did,
              roomId: id,
              fileId: doc.fileId,
              filename: doc.filename,
              language: doc.language,
              content: doc.content,
              yjsState: doc.yjsState || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        return this.findUnique({ where: { id }, include });
      },
    },

    roomParticipant: {
      async create({ data }) {
        // Enforce unique constraint [roomId, userId]
        for (const p of participantMap.values()) {
          if (p.roomId === data.roomId && p.userId === data.userId) {
            const err = new Error("Unique constraint failed on the fields: (`roomId`,`userId`)");
            err.code = "P2002";
            throw err;
          }
        }

        const id = `part_${idCounter++}`;
        const record = {
          id,
          roomId: data.roomId,
          userId: data.userId,
          joinedAt: new Date(),
          updatedAt: new Date(),
        };
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
          Object.assign(existing, update, { updatedAt: new Date() });
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
          createdAt: new Date(),
          updatedAt: new Date(),
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
          Object.assign(found, update, { updatedAt: new Date() });
          return found;
        }

        return this.create({ data: create });
      },
    },
  };
}

async function createTestServer(prisma) {
  const app = createApp(testConfig, { prisma });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const close = () =>
    new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  return { baseUrl, close };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test("Room Code Generator - generates 6 uppercase characters without ambiguous letters", () => {
  const code = generateRoomCode();
  assert.equal(typeof code, "string");
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.doesNotMatch(code, /[0O1I]/);
});

test("POST /api/rooms - unauthenticated request returns 401", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName: "Team Sync" }),
  });

  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test("POST /api/rooms - authenticated user can create a room with persistent initial documents", async (t) => {
  const user = { id: "u-owner-1", name: "Alice Developer", email: "alice@cocode.dev" };
  const prisma = createMockPrisma({ users: [user] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roomName: "Project Alpha" }),
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.equal(typeof body.room.code, "string");
  assert.equal(body.room.code.length, 6);
  assert.equal(body.room.name, "Project Alpha");
  assert.equal(body.room.owner.id, user.id);
  assert.equal(body.room.hostName, user.name);
  assert.equal(body.room.isActive, true);
  assert.equal(body.room.participants.length, 1);
  assert.equal(body.room.participants[0].userId, user.id);

  // Verify persistent documents were provisioned in mock DB
  assert.ok(body.room.documents);
  assert.equal(body.room.documents.length, 3);
  assert.equal(body.room.documents[0].fileId, "f-1");
  assert.equal(body.room.documents[0].filename, "index.js");
});

test("POST /api/rooms - rejects invalid or too short room name", async (t) => {
  const user = { id: "u-owner-2", name: "Bob", email: "bob@cocode.dev" };
  const prisma = createMockPrisma({ users: [user] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roomName: "ab" }),
  });

  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test("POST /api/rooms/join - joining an existing room succeeds", async (t) => {
  const owner = { id: "u-owner", name: "Owner", email: "owner@cocode.dev" };
  const joiner = { id: "u-joiner", name: "Joiner", email: "joiner@cocode.dev" };
  const room = {
    id: "r-existing",
    code: "ROOM01",
    name: "Existing Room",
    isPrivate: true,
    isActive: true,
    ownerId: owner.id,
  };
  const prisma = createMockPrisma({
    users: [owner, joiner],
    rooms: [room],
    participants: [{ id: "p-owner", roomId: room.id, userId: owner.id }],
  });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const joinerToken = signAccessToken(joiner, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${joinerToken}`,
    },
    body: JSON.stringify({ roomCode: "ROOM01" }),
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.room.code, "ROOM01");
  assert.equal(body.room.participants.length, 2);
  const participantIds = body.room.participants.map((p) => p.userId);
  assert.ok(participantIds.includes(joiner.id));
});

test("POST /api/rooms/join - concurrent join requests are race-safe and idempotent", async (t) => {
  const owner = { id: "u-owner-conc", name: "Owner", email: "owner@cocode.dev" };
  const joiner = { id: "u-joiner-conc", name: "Joiner", email: "joiner@cocode.dev" };
  const room = {
    id: "r-conc",
    code: "CONC01",
    name: "Concurrent Room",
    isPrivate: true,
    isActive: true,
    ownerId: owner.id,
  };
  const prisma = createMockPrisma({
    users: [owner, joiner],
    rooms: [room],
    participants: [{ id: "p-owner-c", roomId: room.id, userId: owner.id }],
  });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const joinerToken = signAccessToken(joiner, TEST_SECRET);

  // Send two join requests simultaneously
  const [res1, res2] = await Promise.all([
    fetch(`${baseUrl}/api/rooms/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${joinerToken}` },
      body: JSON.stringify({ roomCode: "CONC01" }),
    }),
    fetch(`${baseUrl}/api/rooms/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${joinerToken}` },
      body: JSON.stringify({ roomCode: "CONC01" }),
    }),
  ]);

  const body1 = await res1.json();
  const body2 = await res2.json();

  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);
  assert.equal(body1.success, true);
  assert.equal(body2.success, true);

  // Exactly one participant record for the joiner in the database
  let joinerCount = 0;
  for (const p of prisma._participants.values()) {
    if (p.roomId === room.id && p.userId === joiner.id) {
      joinerCount++;
    }
  }
  assert.equal(joinerCount, 1, "Concurrent join should produce exactly one participant record");
});

test("POST /api/rooms/join - invalid room code format is rejected with 400", async (t) => {
  const user = { id: "u-test", name: "Tester", email: "test@cocode.dev" };
  const prisma = createMockPrisma({ users: [user] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roomCode: "INVALID_LONG_CODE" }),
  });

  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test("POST /api/rooms/join - non-existent room code returns 404", async (t) => {
  const user = { id: "u-test", name: "Tester", email: "test@cocode.dev" };
  const prisma = createMockPrisma({ users: [user] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roomCode: "ZZZZZZ" }),
  });

  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.success, false);
});

test("POST /api/rooms/join - joining an inactive/closed room returns 410", async (t) => {
  const owner = { id: "u-owner", name: "Owner", email: "owner@cocode.dev" };
  const user = { id: "u-user", name: "User", email: "user@cocode.dev" };
  const closedRoom = {
    id: "r-closed",
    code: "CLOSED",
    name: "Closed Room",
    isActive: false,
    ownerId: owner.id,
  };
  const prisma = createMockPrisma({
    users: [owner, user],
    rooms: [closedRoom],
  });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ roomCode: "CLOSED" }),
  });

  const body = await res.json();
  assert.equal(res.status, 410);
  assert.equal(body.success, false);
});

test("GET /api/rooms/:code - participant can view room info", async (t) => {
  const owner = { id: "u-owner", name: "Owner", email: "owner@cocode.dev" };
  const room = {
    id: "r-1",
    code: "VIEW01",
    name: "Viewable Room",
    isActive: true,
    ownerId: owner.id,
  };
  const prisma = createMockPrisma({
    users: [owner],
    rooms: [room],
    participants: [{ id: "p-1", roomId: room.id, userId: owner.id }],
  });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(owner, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/VIEW01`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.room.code, "VIEW01");
});

test("GET /api/rooms/:code - non-member is denied access with 403", async (t) => {
  const owner = { id: "u-owner", name: "Owner", email: "owner@cocode.dev" };
  const outsider = { id: "u-outsider", name: "Outsider", email: "outsider@cocode.dev" };
  const room = {
    id: "r-secret",
    code: "SECRET",
    name: "Secret Room",
    isActive: true,
    ownerId: owner.id,
  };
  const prisma = createMockPrisma({
    users: [owner, outsider],
    rooms: [room],
    participants: [{ id: "p-owner", roomId: room.id, userId: owner.id }],
  });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const outsiderToken = signAccessToken(outsider, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/SECRET`, {
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });

  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test("GET /api/rooms/:code/documents - participant can retrieve persistent documents", async (t) => {
  const owner = { id: "u-owner", name: "Owner", email: "owner@cocode.dev" };
  const room = {
    id: "r-docs",
    code: "DOCS01",
    name: "Docs Room",
    isActive: true,
    ownerId: owner.id,
  };
  const doc1 = {
    id: "d-1",
    roomId: room.id,
    fileId: "f-1",
    filename: "index.js",
    language: "javascript",
    content: "console.log('persistent');",
  };
  const prisma = createMockPrisma({
    users: [owner],
    rooms: [room],
    participants: [{ id: "p-owner", roomId: room.id, userId: owner.id }],
    documents: [doc1],
  });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(owner, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/DOCS01/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.documents));
  assert.equal(body.documents.length, 1);
  assert.equal(body.documents[0].fileId, "f-1");
  assert.equal(body.documents[0].content, "console.log('persistent');");
});

test("GET /api/rooms/:code/documents - unauthorized non-member is rejected with 403", async (t) => {
  const owner = { id: "u-owner", name: "Owner", email: "owner@cocode.dev" };
  const intruder = { id: "u-intruder", name: "Intruder", email: "intruder@cocode.dev" };
  const room = {
    id: "r-docs-sec",
    code: "DSEC01",
    name: "Docs Secret",
    isActive: true,
    ownerId: owner.id,
  };
  const prisma = createMockPrisma({
    users: [owner, intruder],
    rooms: [room],
    participants: [{ id: "p-owner", roomId: room.id, userId: owner.id }],
  });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const intruderToken = signAccessToken(intruder, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/rooms/DSEC01/documents`, {
    headers: { Authorization: `Bearer ${intruderToken}` },
  });

  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});
