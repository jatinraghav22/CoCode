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

function createMockPrisma({ users = [], projects = [], files = [], activities = [] } = {}) {
  const userMap = new Map();
  const projectMap = new Map();
  const fileMap = new Map();
  const activityMap = new Map();

  for (const u of users) userMap.set(u.id, { ...u });
  for (const p of projects) projectMap.set(p.id, { ...p, files: [] });
  for (const f of files) {
    fileMap.set(f.id, { ...f });
    const p = projectMap.get(f.projectId);
    if (p) {
      if (!p.files) p.files = [];
      p.files.push(fileMap.get(f.id));
    }
  }
  for (const a of activities) activityMap.set(a.id, { ...a });

  return {
    _users: userMap,
    _projects: projectMap,
    _files: fileMap,
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

    project: {
      async count({ where }) {
        let count = 0;
        for (const p of projectMap.values()) {
          if (where.userId && p.userId !== where.userId) continue;
          if (where.OR) {
            let matched = false;
            for (const cond of where.OR) {
              if (cond.name?.contains && p.name.includes(cond.name.contains)) matched = true;
              if (cond.description?.contains && (p.description || "").includes(cond.description.contains)) matched = true;
            }
            if (!matched) continue;
          }
          count++;
        }
        return count;
      },

      async findMany({ where, skip = 0, take = 50, orderBy, include }) {
        const results = [];
        for (const p of projectMap.values()) {
          if (where?.userId && p.userId !== where.userId) continue;
          if (where?.OR) {
            let matched = false;
            for (const cond of where.OR) {
              if (cond.name?.contains && p.name.toLowerCase().includes(cond.name.contains.toLowerCase())) matched = true;
              if (cond.description?.contains && (p.description || "").toLowerCase().includes(cond.description.contains.toLowerCase())) matched = true;
            }
            if (!matched) continue;
          }

          const cloned = { ...p };
          if (include?._count?.select?.files) {
            let fileCount = 0;
            for (const f of fileMap.values()) {
              if (f.projectId === p.id) fileCount++;
            }
            cloned._count = { files: fileCount };
          }
          results.push(cloned);
        }
        return results.slice(skip, skip + take);
      },

      async findUnique({ where, include }) {
        const p = projectMap.get(where.id);
        if (!p) return null;
        const res = { ...p };
        if (include?.files) {
          res.files = Array.from(fileMap.values()).filter((f) => f.projectId === p.id);
        }
        return res;
      },

      async create({ data, include }) {
        const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date();
        const newProj = {
          id,
          userId: data.userId,
          name: data.name,
          description: data.description || null,
          defaultLanguage: data.defaultLanguage || "javascript",
          createdAt: now,
          updatedAt: now,
        };
        projectMap.set(id, newProj);

        if (data.files?.create) {
          for (const fData of data.files.create) {
            const fid = `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newF = {
              id: fid,
              projectId: id,
              name: fData.name,
              path: fData.path,
              language: fData.language,
              content: fData.content,
              createdAt: now,
              updatedAt: now,
            };
            fileMap.set(fid, newF);
          }
        }

        const res = { ...newProj };
        if (include?.files) {
          res.files = Array.from(fileMap.values()).filter((f) => f.projectId === id);
        }
        return res;
      },

      async update({ where, data, include }) {
        const p = projectMap.get(where.id);
        if (!p) throw new Error("Project not found");
        Object.assign(p, data, { updatedAt: new Date() });
        const res = { ...p };
        if (include?.files) {
          res.files = Array.from(fileMap.values()).filter((f) => f.projectId === p.id);
        }
        return res;
      },

      async delete({ where }) {
        const p = projectMap.get(where.id);
        if (!p) throw new Error("Project not found");
        projectMap.delete(where.id);
        for (const [fid, f] of fileMap.entries()) {
          if (f.projectId === where.id) {
            fileMap.delete(fid);
          }
        }
        return p;
      },
    },

    projectFile: {
      async findUnique({ where }) {
        if (where.projectId_path) {
          for (const f of fileMap.values()) {
            if (f.projectId === where.projectId_path.projectId && f.path === where.projectId_path.path) {
              return { ...f };
            }
          }
          return null;
        }
        return fileMap.get(where.id) ? { ...fileMap.get(where.id) } : null;
      },

      async findFirst({ where }) {
        for (const f of fileMap.values()) {
          if (where.id && f.id !== where.id) continue;
          if (where.projectId && f.projectId !== where.projectId) continue;
          return { ...f };
        }
        return null;
      },

      async create({ data }) {
        const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date();
        const newFile = {
          id,
          projectId: data.projectId,
          name: data.name,
          path: data.path,
          language: data.language,
          content: data.content || "",
          createdAt: now,
          updatedAt: now,
        };
        fileMap.set(id, newFile);
        return { ...newFile };
      },

      async update({ where, data }) {
        const f = fileMap.get(where.id);
        if (!f) throw new Error("File not found");
        Object.assign(f, data, { updatedAt: new Date() });
        return { ...f };
      },

      async delete({ where }) {
        const f = fileMap.get(where.id);
        if (!f) throw new Error("File not found");
        fileMap.delete(where.id);
        return { ...f };
      },
    },

    codingActivity: {
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

test("Project API - unauthenticated requests are rejected with 401", async (t) => {
  const prisma = createMockPrisma();
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Unauth Project" }),
  });
  assert.equal(res.status, 401);
});

test("Project API - authenticated user creates a project with initial starter file", async (t) => {
  const user = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const prisma = createMockPrisma({ users: [user] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "Algorithms Workspace",
      description: "Data structures and algorithms in Python",
      defaultLanguage: "python",
    }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.project.id);
  assert.equal(body.project.name, "Algorithms Workspace");
  assert.equal(body.project.defaultLanguage, "python");
  assert.ok(body.project.files.length >= 1, "Starter file created automatically");
  assert.equal(body.project.files[0].path, "/main.py");
  assert.equal(body.project.files[0].language, "python");
});

test("Project API - rejects invalid project name", async (t) => {
  const user = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const prisma = createMockPrisma({ users: [user] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(user, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: "" }),
  });

  assert.equal(res.status, 400);
});

test("Project API - user isolation on listing projects", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const bob = { id: "usr_bob", name: "Bob", email: "bob@example.com" };

  const projAlice = { id: "p_alice", userId: alice.id, name: "Alice Project", defaultLanguage: "javascript" };
  const projBob = { id: "p_bob", userId: bob.id, name: "Bob Project", defaultLanguage: "python" };

  const prisma = createMockPrisma({
    users: [alice, bob],
    projects: [projAlice, projBob],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const aliceToken = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects`, {
    headers: { Authorization: `Bearer ${aliceToken}` },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.projects.length, 1);
  assert.equal(body.projects[0].id, projAlice.id);
  assert.equal(body.projects[0].name, "Alice Project");
});

test("Project API - User B cannot access User A's project (403 Forbidden)", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const bob = { id: "usr_bob", name: "Bob", email: "bob@example.com" };

  const projAlice = { id: "p_alice_secret", userId: alice.id, name: "Secret Project", defaultLanguage: "javascript" };

  const prisma = createMockPrisma({
    users: [alice, bob],
    projects: [projAlice],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const bobToken = signAccessToken(bob, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects/${projAlice.id}`, {
    headers: { Authorization: `Bearer ${bobToken}` },
  });

  assert.equal(res.status, 403);
});

test("Project API - returns 404 for non-existent project", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const prisma = createMockPrisma({ users: [alice] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects/p_non_existent`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 404);
});

test("Project API - owner can update project metadata", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const proj = { id: "p_to_update", userId: alice.id, name: "Old Title", defaultLanguage: "javascript" };

  const prisma = createMockPrisma({
    users: [alice],
    projects: [proj],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects/${proj.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "New Better Title",
      description: "Updated description",
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.project.name, "New Better Title");
  assert.equal(body.project.description, "Updated description");
});

test("Project API - owner can delete project and associated files cascade", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const proj = { id: "p_to_delete", userId: alice.id, name: "To Delete", defaultLanguage: "javascript" };
  const file1 = { id: "f_del_1", projectId: proj.id, name: "index.js", path: "/index.js", content: "console.log(1);" };

  const prisma = createMockPrisma({
    users: [alice],
    projects: [proj],
    files: [file1],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects/${proj.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.equal(prisma._projects.has(proj.id), false);
  assert.equal(prisma._files.has(file1.id), false);
});

test("Project Files API - create, read, update, delete file operations", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const proj = { id: "p_files_test", userId: alice.id, name: "Files Test", defaultLanguage: "javascript" };

  const prisma = createMockPrisma({
    users: [alice],
    projects: [proj],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);

  // 1. Create file
  const createRes = await fetch(`${baseUrl}/api/projects/${proj.id}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "utils.js",
      path: "/src/utils.js",
      language: "javascript",
      content: "export const add = (a, b) => a + b;",
    }),
  });

  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.file.name, "utils.js");
  assert.equal(created.file.path, "/src/utils.js");
  const fileId = created.file.id;

  // 2. Read file
  const readRes = await fetch(`${baseUrl}/api/projects/${proj.id}/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(readRes.status, 200);
  const readBody = await readRes.json();
  assert.equal(readBody.file.content, "export const add = (a, b) => a + b;");

  // 3. Update file content
  const updateRes = await fetch(`${baseUrl}/api/projects/${proj.id}/files/${fileId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: "export const add = (a, b) => a + b;\nexport const sub = (a, b) => a - b;",
    }),
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.ok(updateBody.file.content.includes("sub"));

  // 4. Delete file
  const deleteRes = await fetch(`${baseUrl}/api/projects/${proj.id}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(deleteRes.status, 200);
  assert.equal(prisma._files.has(fileId), false);
});

test("Project Files API - rejects path traversal attempts with 400", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const proj = { id: "p_traversal", userId: alice.id, name: "Traversal Test", defaultLanguage: "javascript" };

  const prisma = createMockPrisma({
    users: [alice],
    projects: [proj],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects/${proj.id}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "evil.js",
      path: "/../../etc/passwd",
    }),
  });

  assert.equal(res.status, 400);
});

test("Project Files API - rejects duplicate file path with 409 Conflict", async (t) => {
  const alice = { id: "usr_alice", name: "Alice", email: "alice@example.com" };
  const proj = { id: "p_dups", userId: alice.id, name: "Dup Test", defaultLanguage: "javascript" };
  const existingFile = { id: "f_dup_1", projectId: proj.id, name: "index.js", path: "/index.js", content: "" };

  const prisma = createMockPrisma({
    users: [alice],
    projects: [proj],
    files: [existingFile],
  });

  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);

  const token = signAccessToken(alice, TEST_SECRET);
  const res = await fetch(`${baseUrl}/api/projects/${proj.id}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "index.js",
      path: "/index.js",
    }),
  });

  assert.equal(res.status, 409);
});
