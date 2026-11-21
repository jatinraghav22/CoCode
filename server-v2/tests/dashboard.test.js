"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { signAccessToken } = require("../src/utils/jwt");

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
 * Creates an in-memory mock Prisma client supporting users, collaboration rooms,
 * room participants, and room documents.
 */
function createMockPrisma({ users = [], rooms = [], participants = [], documents = [], projects = [], activities = [] } = {}) {
  const userMap = new Map();
  const roomMap = new Map();
  const participantMap = new Map();
  const documentMap = new Map();
  const projectMap = new Map();
  const activityMap = new Map();

  for (const u of users) userMap.set(u.id, { ...u });
  for (const r of rooms) roomMap.set(r.id, { ...r, code: r.code.toUpperCase() });
  for (const p of participants) participantMap.set(p.id, { ...p });
  for (const d of documents) documentMap.set(d.id, { ...d });
  for (const pr of projects) projectMap.set(pr.id, { ...pr, files: pr.files || [] });
  for (const a of activities) activityMap.set(a.id, { ...a });

  return {
    _users: userMap,
    _rooms: roomMap,
    _participants: participantMap,
    _documents: documentMap,
    _projects: projectMap,
    _activities: activityMap,

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
      async count({ where }) {
        let count = 0;
        for (const room of roomMap.values()) {
          if (where.isActive !== undefined && room.isActive !== where.isActive) {
            continue;
          }

          if (where.OR) {
            let matched = false;
            for (const cond of where.OR) {
              if (cond.ownerId && room.ownerId === cond.ownerId) {
                matched = true;
                break;
              }
              if (cond.participants?.some?.userId) {
                const targetUserId = cond.participants.some.userId;
                for (const p of participantMap.values()) {
                  if (p.roomId === room.id && p.userId === targetUserId) {
                    matched = true;
                    break;
                  }
                }
                if (matched) break;
              }
            }
            if (matched) count++;
          } else if (where.ownerId) {
            if (room.ownerId === where.ownerId) count++;
          } else {
            count++;
          }
        }
        return count;
      },

      async findMany({ where, select }) {
        const matchedRooms = [];
        for (const room of roomMap.values()) {
          if (where?.OR) {
            let matched = false;
            for (const cond of where.OR) {
              if (cond.ownerId && room.ownerId === cond.ownerId) {
                matched = true;
                break;
              }
              if (cond.participants?.some?.userId) {
                const targetUserId = cond.participants.some.userId;
                for (const p of participantMap.values()) {
                  if (p.roomId === room.id && p.userId === targetUserId) {
                    matched = true;
                    break;
                  }
                }
                if (matched) break;
              }
            }
            if (!matched) continue;
          }

          const roomEntry = { ...room };
          if (select?.documents) {
            const docs = [];
            for (const d of documentMap.values()) {
              if (d.roomId === room.id) {
                docs.push({ language: d.language });
              }
            }
            roomEntry.documents = docs;
          }
          matchedRooms.push(roomEntry);
        }
        return matchedRooms;
      },
    },

    project: {
      async count({ where }) {
        let count = 0;
        for (const pr of projectMap.values()) {
          if (where.userId && pr.userId !== where.userId) continue;
          count++;
        }
        return count;
      },
      async findMany({ where, orderBy, take = 5, select, include }) {
        const results = [];
        for (const pr of projectMap.values()) {
          if (where?.userId && pr.userId !== where.userId) continue;
          const item = { ...pr };
          if (include?.files) {
            item.files = pr.files || [];
          }
          results.push(item);
        }
        return results.slice(0, take);
      },
    },

    codingActivity: {
      async findMany({ where, orderBy, take = 5, select, include }) {
        const results = [];
        for (const act of activityMap.values()) {
          if (where?.userId && act.userId !== where.userId) continue;
          if (where?.createdAt?.gte && new Date(act.createdAt) < new Date(where.createdAt.gte)) continue;
          if (select) {
            const proj = {};
            for (const k of Object.keys(select)) {
              if (select[k]) proj[k] = act[k];
            }
            results.push(proj);
          } else {
            const item = { ...act };
            if (include?.project && act.projectId) {
              const p = projectMap.get(act.projectId);
              item.project = p ? { id: p.id, name: p.name } : null;
            }
            results.push(item);
          }
        }
        return results.slice(0, take);
      },
    },
  };
}

/**
 * Creates ephemeral HTTP test server.
 */
async function createTestServer(prisma) {
  const app = createApp(testConfig, { prisma });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return { baseUrl, close };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Dashboard - GET /api/dashboard returns HTTP 200 with complete structure for authenticated user", async (t) => {
  const user = { id: "usr_alice", name: "Alice Smith", email: "alice@example.com" };
  const prisma = createMockPrisma({ users: [user] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.stats, "Response includes stats object");
  assert.equal(typeof body.stats.totalProjects, "number");
  assert.equal(typeof body.stats.activeRooms, "number");
  assert.equal(typeof body.stats.todayActivityMinutes, "number");
  assert.equal(typeof body.stats.languagesUsedCount, "number");
  assert.ok(Array.isArray(body.recentProjects), "recentProjects is an array");
  assert.ok(Array.isArray(body.popularLanguages), "popularLanguages is an array");
  assert.equal(body.user.id, user.id);
  assert.equal(body.user.name, user.name);
  assert.equal(body.user.email, user.email);
});

test("Dashboard - unauthenticated request is rejected with HTTP 401", async (t) => {
  const prisma = createMockPrisma({});
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  // Missing Authorization header
  const res = await fetch(`${baseUrl}/api/dashboard`);
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);

  // Invalid token
  const badRes = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: "Bearer bad_invalid_token" },
  });
  assert.equal(badRes.status, 401);
});

test("Dashboard - User A cannot access User B's dashboard data (user-scoped isolation)", async (t) => {
  const userA = { id: "usr_a", name: "User A", email: "a@example.com" };
  const userB = { id: "usr_b", name: "User B", email: "b@example.com" };

  const roomB = { id: "room_b1", code: "ROOMB1", name: "Room B", isActive: true, ownerId: userB.id };
  const docB = { id: "doc_b1", roomId: roomB.id, fileId: "f-1", language: "python" };

  const prisma = createMockPrisma({
    users: [userA, userB],
    rooms: [roomB],
    participants: [{ id: "p_b", roomId: roomB.id, userId: userB.id }],
    documents: [docB],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const tokenA = signAccessToken(userA, TEST_SECRET);
  const resA = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataA = await resA.json();

  // User A has 0 rooms, must not see User B's room or language stats
  assert.equal(dataA.user.id, userA.id);
  assert.equal(dataA.stats.activeRooms, 0);
  assert.equal(dataA.stats.languagesUsedCount, 0);
  assert.equal(dataA.popularLanguages.length, 0);

  // User B sees their own room and language stats
  const tokenB = signAccessToken(userB, TEST_SECRET);
  const resB = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const dataB = await resB.json();

  assert.equal(dataB.user.id, userB.id);
  assert.equal(dataB.stats.activeRooms, 1);
  assert.equal(dataB.stats.languagesUsedCount, 1);
  assert.equal(dataB.popularLanguages[0]?.name, "Python");
});

test("Dashboard - new users receive zero/empty statistics", async (t) => {
  const newUser = { id: "usr_new", name: "Fresh User", email: "new@example.com" };
  const prisma = createMockPrisma({ users: [newUser] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(newUser, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.stats.totalProjects, 0);
  assert.equal(body.stats.activeRooms, 0);
  assert.equal(body.stats.todayActivityMinutes, 0);
  assert.equal(body.stats.languagesUsedCount, 0);
  assert.deepEqual(body.recentProjects, []);
  assert.deepEqual(body.popularLanguages, []);
});

test("Dashboard - existing users receive their own persisted room and language data", async (t) => {
  const user = { id: "usr_senior", name: "Senior Dev", email: "senior@example.com" };
  const room1 = { id: "room_s1", code: "SENR01", name: "Collab 1", isActive: true, ownerId: user.id };
  const room2 = { id: "room_s2", code: "SENR02", name: "Collab 2", isActive: true, ownerId: user.id };
  const closedRoom = { id: "room_s3", code: "SENR03", name: "Closed Room", isActive: false, ownerId: user.id };

  const doc1 = { id: "doc_1", roomId: room1.id, fileId: "f-1", language: "javascript" };
  const doc2 = { id: "doc_2", roomId: room1.id, fileId: "f-2", language: "javascript" };
  const doc3 = { id: "doc_3", roomId: room2.id, fileId: "f-3", language: "python" };

  const prisma = createMockPrisma({
    users: [user],
    rooms: [room1, room2, closedRoom],
    participants: [
      { id: "p_1", roomId: room1.id, userId: user.id },
      { id: "p_2", roomId: room2.id, userId: user.id },
      { id: "p_3", roomId: closedRoom.id, userId: user.id },
    ],
    documents: [doc1, doc2, doc3],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  // Only 2 active rooms (closedRoom is excluded)
  assert.equal(body.stats.activeRooms, 2);
  // 2 unique languages: javascript and python
  assert.equal(body.stats.languagesUsedCount, 2);
  assert.equal(body.popularLanguages.length, 2);

  const jsLang = body.popularLanguages.find((l) => l.name === "JavaScript");
  const pyLang = body.popularLanguages.find((l) => l.name === "Python");
  assert.ok(jsLang, "JavaScript is present in popularLanguages");
  assert.ok(pyLang, "Python is present in popularLanguages");
  // JS has 2 docs, Py has 1 doc: JS should be ~67%, Py ~33%
  assert.ok(jsLang.percentage > pyLang.percentage);
});

test("Dashboard - missing optional data or empty models does not cause HTTP 500", async (t) => {
  // Prisma where collaborationRoom has no records at all
  const user = { id: "usr_bare", name: "Bare User", email: "bare@example.com" };
  const prisma = {
    user: {
      async findUnique() {
        return { ...user };
      },
    },
    // collaborationRoom model throws unexpected error
    collaborationRoom: {
      async count() {
        throw new Error("Temporary DB lock");
      },
      async findMany() {
        throw new Error("Temporary DB lock");
      },
    },
  };

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  // Must gracefully return 200 with safe defaults, not 500
  assert.equal(res.status, 200);
  assert.equal(body.stats.activeRooms, 0);
  assert.equal(body.stats.languagesUsedCount, 0);
  assert.deepEqual(body.popularLanguages, []);
});

test("Dashboard - frontend uses the correct API endpoint (/api/dashboard)", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dashboardSource = fs.readFileSync(
    path.join(__dirname, "../../client/src/pages/Dashboard.jsx"),
    "utf-8"
  );

  assert.match(
    dashboardSource,
    /fetch\(`\$\{API_BASE\}\/api\/dashboard`/,
    "Dashboard.jsx calls /api/dashboard endpoint"
  );
});

test("Dashboard - returns real persisted project count and recent projects", async (t) => {
  const user = { id: "usr_dev_1", name: "Dev One", email: "dev1@example.com" };
  const proj1 = {
    id: "proj_1",
    userId: user.id,
    name: "Web Scraper",
    description: "Python scraping toolkit",
    defaultLanguage: "python",
    createdAt: new Date(),
    updatedAt: new Date(),
    files: [{ id: "f1", name: "scraper.py", language: "python" }],
  };
  const proj2 = {
    id: "proj_2",
    userId: user.id,
    name: "React Dashboard",
    description: "Frontend analytics",
    defaultLanguage: "javascript",
    createdAt: new Date(),
    updatedAt: new Date(),
    files: [{ id: "f2", name: "App.jsx", language: "javascript" }],
  };

  const prisma = createMockPrisma({
    users: [user],
    projects: [proj1, proj2],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.stats.totalProjects, 2);
  assert.equal(body.recentProjects.length, 2);
  assert.equal(body.recentProjects[0].name, "Web Scraper");
  assert.equal(body.recentProjects[0].fileCount, 1);
});

test("Dashboard - returns real today's activity minutes and recent activities", async (t) => {
  const user = { id: "usr_dev_2", name: "Dev Two", email: "dev2@example.com" };
  const now = new Date();
  const act1 = {
    id: "act_1",
    userId: user.id,
    language: "python",
    eventType: "execution_success",
    status: "success",
    durationSeconds: 120, // 2 minutes
    createdAt: now,
  };
  const act2 = {
    id: "act_2",
    userId: user.id,
    language: "javascript",
    eventType: "execution_success",
    status: "success",
    durationSeconds: 60, // 1 minute
    createdAt: now,
  };

  const prisma = createMockPrisma({
    users: [user],
    activities: [act1, act2],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.stats.todayActivityMinutes, 3); // 120s + 60s = 180s = 3 mins
  assert.equal(body.recentActivities.length, 2);
});

test("Dashboard - user isolation on projects and activities", async (t) => {
  const alice = { id: "usr_alice_d", name: "Alice", email: "alice.d@example.com" };
  const bob = { id: "usr_bob_d", name: "Bob", email: "bob.d@example.com" };

  const projAlice = { id: "p_alice", userId: alice.id, name: "Alice's Project", defaultLanguage: "javascript", updatedAt: new Date() };
  const projBob = { id: "p_bob", userId: bob.id, name: "Bob's Project", defaultLanguage: "python", updatedAt: new Date() };

  const actAlice = { id: "act_alice", userId: alice.id, language: "javascript", eventType: "file_created", status: "success", createdAt: new Date() };
  const actBob = { id: "act_bob", userId: bob.id, language: "python", eventType: "file_created", status: "success", createdAt: new Date() };

  const prisma = createMockPrisma({
    users: [alice, bob],
    projects: [projAlice, projBob],
    activities: [actAlice, actBob],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const aliceToken = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.stats.totalProjects, 1);
  assert.equal(body.recentProjects[0].name, "Alice's Project");
  assert.equal(body.recentActivities.length, 1);
  assert.equal(body.recentActivities[0].id, "act_alice");
});
