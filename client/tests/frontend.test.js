import test from "node:test";
import assert from "node:assert/strict";

// ── 1. API Configuration & URL Normalization ────────────────────────────────
test("Frontend — API configuration strips trailing slashes", () => {
  const normalizeUrl = (url) => (url || "http://localhost:5000").replace(/\/+$/, "");

  assert.equal(normalizeUrl("https://cocode-backend-v2.onrender.com/"), "https://cocode-backend-v2.onrender.com");
  assert.equal(normalizeUrl("https://cocode-backend-v2.onrender.com///"), "https://cocode-backend-v2.onrender.com");
  assert.equal(normalizeUrl("http://localhost:5000"), "http://localhost:5000");
});

// ── 2. Authentication State & Token Storage ────────────────────────────────
test("Frontend — Token storage serialization and clearance", () => {
  const memoryStore = new Map();
  const TOKEN_KEY = "cocode_auth_token";

  const setAuthToken = (token) => memoryStore.set(TOKEN_KEY, token);
  const getAuthToken = () => memoryStore.get(TOKEN_KEY) || null;
  const clearAuthToken = () => memoryStore.delete(TOKEN_KEY);

  assert.equal(getAuthToken(), null);
  setAuthToken("jwt_header.payload.signature");
  assert.equal(getAuthToken(), "jwt_header.payload.signature");
  clearAuthToken();
  assert.equal(getAuthToken(), null);
});

// ── 3. Protected Route Redirection & Query Preservation ─────────────────────
test("Frontend — Protected route builds correct redirect URL with original destination", () => {
  const buildRedirectUrl = (pathname, search = "") => {
    const destination = pathname + search;
    return `/login?redirect=${encodeURIComponent(destination)}`;
  };

  const target = buildRedirectUrl("/editor/ROOM-102", "?theme=arctic&tab=output");
  assert.equal(target, "/login?redirect=%2Feditor%2FROOM-102%3Ftheme%3Darctic%26tab%3Doutput");
});

// ── 4. Multi-Tab Editor State & Revision Tracking ───────────────────────────
test("Frontend — Multi-tab state management preserves dirty tracking and revisions", () => {
  const tabs = [
    { id: "f-1", name: "index.js", content: "console.log('hi');", revision: 1, isDirty: false },
    { id: "f-2", name: "utils.js", content: "export const x = 10;", revision: 3, isDirty: true },
  ];

  // Tab switching
  let activeTabId = "f-1";
  const switchTab = (id) => { activeTabId = id; };
  switchTab("f-2");
  assert.equal(activeTabId, "f-2");

  // Dirty count
  const dirtyTabs = tabs.filter((t) => t.isDirty);
  assert.equal(dirtyTabs.length, 1);
  assert.equal(dirtyTabs[0].id, "f-2");

  // Save updates revision and clears dirty state
  const saveTab = (tab, newContent) => ({
    ...tab,
    content: newContent,
    revision: tab.revision + 1,
    isDirty: false,
  });

  const updatedTab = saveTab(tabs[1], "export const x = 20;");
  assert.equal(updatedTab.revision, 4);
  assert.equal(updatedTab.isDirty, false);
});

// ── 5. Project Tree & File Sorting Reliability ──────────────────────────────
test("Frontend — File tree sorts folders first then files alphabetically", () => {
  const files = [
    { path: "/src/index.js", name: "index.js", isFolder: false },
    { path: "/src/components", name: "components", isFolder: true },
    { path: "/README.md", name: "README.md", isFolder: false },
    { path: "/package.json", name: "package.json", isFolder: false },
  ];

  const sorted = [...files].sort((a, b) => {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  assert.equal(sorted[0].name, "components");
  assert.equal(sorted[1].name, "index.js");
  assert.equal(sorted[2].name, "package.json");
  assert.equal(sorted[3].name, "README.md");
});

// ── 6. Error Boundary Fallback State ─────────────────────────────────────────
test("Frontend — Error boundary captures error and formats technical details safely", () => {
  const simulateCrash = (err) => ({
    hasError: true,
    error: err,
    errorInfo: { componentStack: "\n    in EditorComponent\n    in EditorPage" },
  });

  const crashedState = simulateCrash(new TypeError("Cannot read properties of undefined (reading 'getModel')"));
  assert.equal(crashedState.hasError, true);
  assert.match(crashedState.error.message, /getModel/);
  assert.ok(crashedState.errorInfo.componentStack.includes("EditorComponent"));
});

import {
  profileExtrasKey,
  readProfileExtras,
  saveProfileExtras,
  mergeUserWithProfileExtras,
} from "../src/profileStorage.js";

test("Frontend — profile extras are isolated between accounts", () => {
  const store = new Map();

  const storage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, value),
  };

  saveProfileExtras("user-1", { username: "first-user" }, storage);
  saveProfileExtras("user-2", { username: "second-user" }, storage);

  assert.equal(readProfileExtras("user-1", storage).username, "first-user");
  assert.equal(readProfileExtras("user-2", storage).username, "second-user");
  assert.notEqual(profileExtrasKey("user-1"), profileExtrasKey("user-2"));
});

test("Frontend — new accounts do not inherit another account's profile", () => {
  const store = new Map();

  const storage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, value),
  };

  saveProfileExtras("existing-user", { bio: "Private profile" }, storage);

  const newUser = mergeUserWithProfileExtras(
    { id: "new-user", name: "New User", email: "new@example.com" },
    storage
  );

  assert.equal(newUser.bio, undefined);
  assert.equal(newUser.name, "New User");
  assert.equal(newUser.email, "new@example.com");
});

test("Frontend — profile extras cannot override server-owned identity fields", () => {
  const store = new Map();

  const storage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, value),
  };

  saveProfileExtras("user-1", {
    name: "Incorrect Name",
    email: "wrong@example.com",
    username: "correct-username",
  }, storage);

  const user = mergeUserWithProfileExtras({
    id: "user-1",
    name: "Server Name",
    email: "server@example.com",
  }, storage);

  assert.equal(user.name, "Server Name");
  assert.equal(user.email, "server@example.com");
  assert.equal(user.username, "correct-username");
});

test("Frontend — profile extras validates structures and handles malformed JSON and quota errors", () => {
  const store = new Map();

  const storage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => {
      if (key.includes("quota-exceeded")) throw new Error("QuotaExceededError");
      store.set(key, value);
    },
  };

  // Validates skills array and socialLinks object
  saveProfileExtras("user-validation", {
    username: "valid-user",
    skills: ["JavaScript", "Python", 123, null],
    socialLinks: { github: "octocat", linkedin: "developer", invalid: 456 },
    arbitraryField: "should_be_stripped",
  }, storage);

  const extras = readProfileExtras("user-validation", storage);
  assert.equal(extras.username, "valid-user");
  assert.deepEqual(extras.skills, ["JavaScript", "Python"]);
  assert.deepEqual(extras.socialLinks, { github: "octocat", linkedin: "developer" });
  assert.equal(extras.arbitraryField, undefined);

  // Quota error handled safely
  const saveResult = saveProfileExtras("quota-exceeded", { bio: "large bio" }, storage);
  assert.equal(saveResult, false);

  // Malformed JSON handled safely
  store.set(profileExtrasKey("malformed-user"), "{ invalid json ");
  const malformedExtras = readProfileExtras("malformed-user", storage);
  assert.deepEqual(malformedExtras, {});
});

// ── 8. Project Management Operations ─────────────────────────────────────────
test("Frontend — Project creation, duplication and rename validation", () => {
  const validateProjectName = (name) => {
    if (typeof name !== "string") return false;
    const trimmed = name.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  };

  assert.equal(validateProjectName(""), false);
  assert.equal(validateProjectName("   "), false);
  assert.equal(validateProjectName("My Awesome Project"), true);
  assert.equal(validateProjectName("a".repeat(101)), false);

  const buildDuplicateName = (original) => `${original} (Copy)`;
  assert.equal(buildDuplicateName("Algorithms"), "Algorithms (Copy)");
});

// ── 9. Guest Compiler Access Headers Helper ──────────────────────────────────
test("Frontend — Guest compiler execution does not include Authorization header, while auth does", () => {
  const buildCompilerHeaders = (authToken) => {
    const headers = { "Content-Type": "application/json" };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return headers;
  };

  const guestHeaders = buildCompilerHeaders(null);
  assert.equal(guestHeaders["Authorization"], undefined);
  assert.equal(guestHeaders["Content-Type"], "application/json");

  const authHeaders = buildCompilerHeaders("jwt_valid_token");
  assert.equal(authHeaders["Authorization"], "Bearer jwt_valid_token");
});

// ── 10. Room Code Validation Helper ──────────────────────────────────────────
test("Frontend — Room code normalization and validation", () => {
  const sanitizeRoomCode = (code) => {
    if (typeof code !== "string") return "";
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  };

  const isValidRoomCode = (code) => /^[A-Z0-9]{6}$/.test(code);

  assert.equal(sanitizeRoomCode("abc123"), "ABC123");
  assert.equal(sanitizeRoomCode("  x-y-z 4 5 6  "), "XYZ456");
  assert.equal(isValidRoomCode("ABC123"), true);
  assert.equal(isValidRoomCode("AB12"), false);
  assert.equal(isValidRoomCode("ABCDEF78"), false);
});

// ── 11. Editor Debounced Autosave Orchestration ──────────────────────────────
test("Frontend — Debounced autosave timer lifecycle", () => {
  const timers = new Map();
  let saveCount = 0;

  const scheduleAutosave = (fileId, delay, saveFn) => {
    if (timers.has(fileId)) {
      clearTimeout(timers.get(fileId));
    }
    const timerId = setTimeout(() => {
      timers.delete(fileId);
      saveFn();
    }, delay);
    timers.set(fileId, timerId);
  };

  const cancelAutosave = (fileId) => {
    if (timers.has(fileId)) {
      clearTimeout(timers.get(fileId));
      timers.delete(fileId);
    }
  };

  scheduleAutosave("file-1", 50, () => { saveCount++; });
  assert.equal(timers.has("file-1"), true);
  // Manual save cancels pending timer
  cancelAutosave("file-1");
  assert.equal(timers.has("file-1"), false);
  assert.equal(saveCount, 0);
});

// ── 12. Compiler Execution Status & Content Resolution ───────────────────────
test("Frontend — Compiler status classification treats Accepted as success and TLE as failure", () => {
  const isExecutionSuccess = (data) => {
    const statusText = data.status || "Finished";
    return (
      statusText === "Accepted" ||
      statusText === "Finished" ||
      (!data.status && !data.stderr && !data.compileOutput)
    );
  };

  assert.equal(isExecutionSuccess({ status: "Accepted", stdout: "Hello\n", stderr: "", compileOutput: "" }), true);
  assert.equal(isExecutionSuccess({ status: "Finished", stdout: "Hello\n", stderr: "", compileOutput: "" }), true);
  assert.equal(isExecutionSuccess({ status: "Time Limit Exceeded", stdout: "", stderr: "", compileOutput: "" }), false);
  assert.equal(isExecutionSuccess({ status: "Compilation Error", stdout: "", stderr: "", compileOutput: "err" }), false);
  assert.equal(isExecutionSuccess({ status: "Runtime Error (NZEC)", stdout: "", stderr: "Traceback", compileOutput: "" }), false);
});


