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

function createMockPrisma({ users = [], projects = [], files = [] } = {}) {
  const userMap = new Map();
  const projectMap = new Map();
  const fileMap = new Map();

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

  return {
    _users: userMap,
    _projects: projectMap,
    _files: fileMap,

    async $transaction(callback) {
      // Snapshot state for atomic transaction simulation
      const userSnapshot = new Map(userMap);
      const projectSnapshot = new Map();
      for (const [k, v] of projectMap.entries()) {
        projectSnapshot.set(k, { ...v, files: v.files ? [...v.files] : [] });
      }
      const fileSnapshot = new Map();
      for (const [k, v] of fileMap.entries()) {
        fileSnapshot.set(k, { ...v });
      }

      try {
        return await callback(this);
      } catch (err) {
        // Rollback state on transaction failure
        userMap.clear();
        for (const [k, v] of userSnapshot.entries()) userMap.set(k, v);
        projectMap.clear();
        for (const [k, v] of projectSnapshot.entries()) projectMap.set(k, v);
        fileMap.clear();
        for (const [k, v] of fileSnapshot.entries()) fileMap.set(k, v);
        throw err;
      }
    },

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
      async findUnique({ where, include }) {
        const p = projectMap.get(where.id);
        if (!p) return null;
        const res = { ...p };
        if (include?.files) {
          res.files = Array.from(fileMap.values()).filter((f) => f.projectId === p.id);
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
        if (f._simulateDbError) throw new Error("Simulated database failure during batch write");
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

test("Phase 8 - Folder Management API - create nested folder", async (t) => {
  const user = { id: "u_folder_1", email: "f1@cocode.dev", name: "Folder User" };
  const project = { id: "p_folder_1", userId: user.id, name: "Folder Project", defaultLanguage: "javascript" };
  const prisma = createMockPrisma({ users: [user], projects: [project] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path: "/src/components" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.folder.path, "/src/components");
  assert.equal(body.folder.name, "components");

  // Check placeholder keep file was created
  const keepFile = Array.from(prisma._files.values()).find(
    (f) => f.projectId === project.id && f.path === "/src/components/.cocode-keep"
  );
  assert.ok(keepFile, "keep placeholder exists in mock db");
});

test("Phase 8 - Folder Management API - rejects path traversal in folder path", async (t) => {
  const user = { id: "u_folder_2", email: "f2@cocode.dev", name: "Folder User 2" };
  const project = { id: "p_folder_2", userId: user.id, name: "Traversal Project", defaultLanguage: "javascript" };
  const prisma = createMockPrisma({ users: [user], projects: [project] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path: "/src/../../etc" }),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /traversal/i);
});

test("Phase 8 - Folder Management API - rename folder recursively moves nested files", async (t) => {
  const user = { id: "u_folder_3", email: "f3@cocode.dev", name: "Folder User 3" };
  const project = { id: "p_folder_3", userId: user.id, name: "Rename Project", defaultLanguage: "javascript" };
  const files = [
    { id: "f_r1", projectId: project.id, name: "Button.jsx", path: "/src/components/Button.jsx", language: "javascript", content: "export default () => <button>Click</button>;" },
    { id: "f_r2", projectId: project.id, name: "Input.jsx", path: "/src/components/forms/Input.jsx", language: "javascript", content: "export default () => <input />;" },
    { id: "f_r3", projectId: project.id, name: "main.jsx", path: "/src/main.jsx", language: "javascript", content: "import Button from './components/Button';" },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/folders`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ oldPath: "/src/components", newPath: "/src/ui" }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.count, 2);

  // Verify paths updated in mock db
  const file1 = prisma._files.get("f_r1");
  const file2 = prisma._files.get("f_r2");
  const file3 = prisma._files.get("f_r3");

  assert.equal(file1.path, "/src/ui/Button.jsx");
  assert.equal(file2.path, "/src/ui/forms/Input.jsx");
  assert.equal(file3.path, "/src/main.jsx"); // untouched
});

test("Phase 8 - Folder Management API - delete folder recursively deletes nested files", async (t) => {
  const user = { id: "u_folder_4", email: "f4@cocode.dev", name: "Folder User 4" };
  const project = { id: "p_folder_4", userId: user.id, name: "Delete Project", defaultLanguage: "javascript" };
  const files = [
    { id: "f_d1", projectId: project.id, name: "util.js", path: "/src/utils/util.js", language: "javascript", content: "export const add = (a, b) => a + b;" },
    { id: "f_d2", projectId: project.id, name: "math.js", path: "/src/utils/math.js", language: "javascript", content: "export const pi = 3.14;" },
    { id: "f_d3", projectId: project.id, name: "index.js", path: "/index.js", language: "javascript", content: "console.log('hi');" },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/folders?path=/src/utils`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.count, 2);

  assert.equal(prisma._files.has("f_d1"), false);
  assert.equal(prisma._files.has("f_d2"), false);
  assert.equal(prisma._files.has("f_d3"), true);
});

test("Phase 8 - Project-wide Search API - searches matches across project files", async (t) => {
  const user = { id: "u_search_1", email: "s1@cocode.dev", name: "Search User" };
  const project = { id: "p_search_1", userId: user.id, name: "Search Project", defaultLanguage: "javascript" };
  const files = [
    { id: "f_s1", projectId: project.id, name: "index.js", path: "/index.js", language: "javascript", content: "const message = 'Hello World';\nconsole.log(message);" },
    { id: "f_s2", projectId: project.id, name: "greet.py", path: "/greet.py", language: "python", content: "def hello():\n    print('Hello World')\n" },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/search?q=Hello`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  // Default is case-insensitive: matches 'Hello' in index.js, 'hello' in def hello(), and 'Hello' in print
  assert.equal(body.totalMatches, 3);
  assert.equal(body.matches[0].fileName, "index.js");
  assert.equal(body.matches[0].lineNumber, 1);

  // Test case-sensitive search
  const resCase = await fetch(`${baseUrl}/api/projects/${project.id}/search?q=Hello&matchCase=true`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const bodyCase = await resCase.json();
  assert.equal(bodyCase.totalMatches, 2);
});

test("Phase 8 - Batch Save API - saves multiple modified files in one call", async (t) => {
  const user = { id: "u_batch_1", email: "b1@cocode.dev", name: "Batch User" };
  const project = { id: "p_batch_1", userId: user.id, name: "Batch Project", defaultLanguage: "javascript" };
  const files = [
    { id: "f_b1", projectId: project.id, name: "a.js", path: "/a.js", language: "javascript", content: "initial a" },
    { id: "f_b2", projectId: project.id, name: "b.js", path: "/b.js", language: "javascript", content: "initial b" },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/save-all`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: [
        { id: "f_b1", content: "updated a content" },
        { id: "f_b2", content: "updated b content" },
      ],
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.count, 2);

  assert.equal(prisma._files.get("f_b1").content, "updated a content");
  assert.equal(prisma._files.get("f_b2").content, "updated b content");
});

test("Phase 8 - Security & Ownership - other user cannot access project search or folders", async (t) => {
  const owner = { id: "u_owner", email: "owner@cocode.dev", name: "Owner" };
  const attacker = { id: "u_attacker", email: "attacker@cocode.dev", name: "Attacker" };
  const project = { id: "p_private", userId: owner.id, name: "Private Project", defaultLanguage: "javascript" };
  const prisma = createMockPrisma({ users: [owner, attacker], projects: [project] });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const attackerToken = signAccessToken(attacker, TEST_SECRET);

  const searchRes = await fetch(`${baseUrl}/api/projects/${project.id}/search?q=test`, {
    headers: { Authorization: `Bearer ${attackerToken}` },
  });
  assert.equal(searchRes.status, 403);

  const folderRes = await fetch(`${baseUrl}/api/projects/${project.id}/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${attackerToken}`,
    },
    body: JSON.stringify({ path: "/injected" }),
  });
  assert.equal(folderRes.status, 403);
});

test("Phase 8.9 - Save All Integrity - rejects nonexistent or invalid file ID with 404", async (t) => {
  const user = { id: "u_saveall_1", email: "sa1@cocode.dev", name: "SaveAll User 1" };
  const project = { id: "p_saveall_1", userId: user.id, name: "SaveAll Project", defaultLanguage: "javascript" };
  const files = [
    { id: "f_sa1", projectId: project.id, name: "main.js", path: "/main.js", language: "javascript", content: "initial" },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/save-all`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: [
        { id: "f_sa1", content: "new content" },
        { id: "non_existent_id", content: "ghost content" },
      ],
    }),
  });

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /does not exist in this project/i);
  // Ensure original file content was not touched
  assert.equal(prisma._files.get("f_sa1").content, "initial");
});

test("Phase 8.9 - Save All Integrity - rejects file belonging to another project with 404", async (t) => {
  const user = { id: "u_saveall_2", email: "sa2@cocode.dev", name: "SaveAll User 2" };
  const project1 = { id: "p_saveall_p1", userId: user.id, name: "Project 1", defaultLanguage: "javascript" };
  const project2 = { id: "p_saveall_p2", userId: user.id, name: "Project 2", defaultLanguage: "javascript" };
  const files = [
    { id: "f_p1_file", projectId: project1.id, name: "p1.js", path: "/p1.js", language: "javascript", content: "p1 initial" },
    { id: "f_p2_file", projectId: project2.id, name: "p2.js", path: "/p2.js", language: "javascript", content: "p2 initial" },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project1, project2], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  // Attempt to save project 2's file through project 1's endpoint
  const res = await fetch(`${baseUrl}/api/projects/${project1.id}/save-all`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: [
        { id: "f_p2_file", content: "malicious update to foreign project file" },
      ],
    }),
  });

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /does not exist in this project/i);
  assert.equal(prisma._files.get("f_p2_file").content, "p2 initial");
});

test("Phase 8.9 - Save All Integrity - rejects oversized file with 413", async (t) => {
  const user = { id: "u_saveall_3", email: "sa3@cocode.dev", name: "SaveAll User 3" };
  const project = { id: "p_saveall_3", userId: user.id, name: "Size Project", defaultLanguage: "javascript" };
  const files = [
    { id: "f_oversize", projectId: project.id, name: "big.js", path: "/big.js", language: "javascript", content: "small" },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const oversizedContent = "x".repeat(1024 * 1024 + 10);
  const res = await fetch(`${baseUrl}/api/projects/${project.id}/save-all`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: [{ id: "f_oversize", content: oversizedContent }],
    }),
  });

  assert.equal(res.status, 413);
  const body = await res.json();
  assert.match(body.error, /exceeds 1MB limit/i);
  assert.equal(prisma._files.get("f_oversize").content, "small");
});

test("Phase 8.9 - Save All Integrity - rolls back all file updates when an error occurs during batch", async (t) => {
  const user = { id: "u_saveall_4", email: "sa4@cocode.dev", name: "SaveAll User 4" };
  const project = { id: "p_saveall_4", userId: user.id, name: "Tx Project", defaultLanguage: "javascript" };
  const files = [
    { id: "f_tx1", projectId: project.id, name: "file1.js", path: "/file1.js", language: "javascript", content: "initial 1" },
    { id: "f_tx2", projectId: project.id, name: "file2.js", path: "/file2.js", language: "javascript", content: "initial 2", _simulateDbError: true },
  ];
  const prisma = createMockPrisma({ users: [user], projects: [project], files });
  const { baseUrl, close } = await createTestServer(prisma);
  t.after(close);
  const token = signAccessToken(user, TEST_SECRET);

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/save-all`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: [
        { id: "f_tx1", content: "updated 1" },
        { id: "f_tx2", content: "updated 2" },
      ],
    }),
  });

  assert.equal(res.status, 500);
  // Crucial check: file 1 was updated inside the transaction loop first, but must have rolled back
  assert.equal(prisma._files.get("f_tx1").content, "initial 1", "f_tx1 should roll back to initial 1");
  assert.equal(prisma._files.get("f_tx2").content, "initial 2", "f_tx2 should remain initial 2");
});
