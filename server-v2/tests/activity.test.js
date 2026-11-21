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

function createMockPrisma({ users = [], activities = [], projects = [] } = {}) {
  const userMap = new Map();
  const activityMap = new Map();
  const projectMap = new Map();

  for (const u of users) userMap.set(u.id, { ...u });
  for (const a of activities) activityMap.set(a.id, { ...a });
  for (const p of projects) projectMap.set(p.id, { ...p });

  return {
    _users: userMap,
    _activities: activityMap,
    _projects: projectMap,

    user: {
      async findUnique({ where }) {
        const u = userMap.get(where.id);
        return u ? { ...u } : null;
      },
    },

    project: {
      async findUnique({ where }) {
        const p = projectMap.get(where.id);
        return p ? { ...p } : null;
      },
    },

    codingActivity: {
      async count({ where }) {
        let count = 0;
        for (const a of activityMap.values()) {
          if (where.userId && a.userId !== where.userId) continue;
          if (where.eventType && a.eventType !== where.eventType) continue;
          if (where.projectId && a.projectId !== where.projectId) continue;
          if (where.createdAt) {
            if (where.createdAt.gte && new Date(a.createdAt) < new Date(where.createdAt.gte)) continue;
            if (where.createdAt.lte && new Date(a.createdAt) > new Date(where.createdAt.lte)) continue;
          }
          count++;
        }
        return count;
      },

      async findMany({ where, skip = 0, take = 50, orderBy, select, include }) {
        const results = [];
        for (const a of activityMap.values()) {
          if (where?.userId && a.userId !== where.userId) continue;
          if (where?.eventType && a.eventType !== where.eventType) continue;
          if (where?.projectId && a.projectId !== where.projectId) continue;
          if (where?.createdAt) {
            if (where.createdAt.gte && new Date(a.createdAt) < new Date(where.createdAt.gte)) continue;
            if (where.createdAt.lte && new Date(a.createdAt) > new Date(where.createdAt.lte)) continue;
          }

          if (select) {
            const projected = {};
            for (const k of Object.keys(select)) {
              if (select[k]) projected[k] = a[k];
            }
            results.push(projected);
          } else {
            const item = { ...a };
            if (include?.project && a.projectId) {
              const p = projectMap.get(a.projectId);
              item.project = p ? { id: p.id, name: p.name } : null;
            }
            results.push(item);
          }
        }

        results.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
        return results.slice(skip, skip + take);
      },

      async create({ data }) {
        const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const record = {
          id,
          userId: data.userId,
          projectId: data.projectId || null,
          language: data.language,
          eventType: data.eventType,
          status: data.status,
          durationSeconds: data.durationSeconds || null,
          createdAt: new Date(),
        };
        activityMap.set(id, record);
        return { ...record };
      },
    },
  };
}

async function createTestServer(prisma) {
  const app = createApp(testConfig, { prisma });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { baseUrl, close };
}

test("Activity API - unauthenticated requests are rejected with 401", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/activity`);
  assert.equal(res.status, 401);
});

test("Activity API - returns paginated activity history with user isolation", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const bob = { id: "usr_bob", name: "Bob", email: "bob@example.com" };

  const actAlice1 = {
    id: "act_a1",
    userId: alice.id,
    language: "python",
    eventType: "execution_success",
    status: "success",
    durationSeconds: 1,
    createdAt: new Date(),
  };
  const actAlice2 = {
    id: "act_a2",
    userId: alice.id,
    language: "javascript",
    eventType: "file_created",
    status: "success",
    durationSeconds: null,
    createdAt: new Date(),
  };
  const actBob = {
    id: "act_b1",
    userId: bob.id,
    language: "cpp",
    eventType: "execution_success",
    status: "success",
    durationSeconds: 2,
    createdAt: new Date(),
  };

  const prisma = createMockPrisma({
    users: [alice, bob],
    activities: [actAlice1, actAlice2, actBob],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/activity`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.activities.length, 2);
  assert.equal(body.pagination.total, 2);
  // Ensure Bob's activity is not visible to Alice
  assert.ok(body.activities.every((a) => a.userId === alice.id));
});

test("Activity API - filters activities by eventType", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };

  const act1 = { id: "act_1", userId: alice.id, language: "python", eventType: "execution_success", status: "success", createdAt: new Date() };
  const act2 = { id: "act_2", userId: alice.id, language: "python", eventType: "execution_failed", status: "failed", createdAt: new Date() };
  const act3 = { id: "act_3", userId: alice.id, language: "python", eventType: "project_created", status: "success", createdAt: new Date() };

  const prisma = createMockPrisma({
    users: [alice],
    activities: [act1, act2, act3],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/activity?eventType=execution_failed`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.activities.length, 1);
  assert.equal(body.activities[0].eventType, "execution_failed");
});

test("Activity Summary API - computes aggregated statistics and language breakdown", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };

  const act1 = { id: "act_1", userId: alice.id, language: "python", eventType: "execution_success", status: "success", durationSeconds: 12, createdAt: new Date() };
  const act2 = { id: "act_2", userId: alice.id, language: "python", eventType: "execution_success", status: "success", durationSeconds: 8, createdAt: new Date() };
  const act3 = { id: "act_3", userId: alice.id, language: "javascript", eventType: "execution_success", status: "success", durationSeconds: 5, createdAt: new Date() };

  const prisma = createMockPrisma({
    users: [alice],
    activities: [act1, act2, act3],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/activity/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.summary.totalEvents, 3);
  assert.equal(body.summary.todayCount, 3);
  assert.equal(body.summary.todayDurationSeconds, 25);
  assert.ok(body.summary.languageUsage.length >= 2);
  const pyUsage = body.summary.languageUsage.find((u) => u.language === "python");
  assert.equal(pyUsage.count, 2);
});

test("Activity Summary API - empty user returns zero counts without errors", async (t) => {
  const emptyUser = { id: "usr_empty", name: "Empty", email: "empty@example.com" };
  const prisma = createMockPrisma({ users: [emptyUser] });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(emptyUser, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/activity/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.summary.totalEvents, 0);
  assert.equal(body.summary.todayCount, 0);
  assert.equal(body.summary.todayDurationSeconds, 0);
  assert.deepEqual(body.summary.recentEvents, []);
});
