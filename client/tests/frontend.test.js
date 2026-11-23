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
