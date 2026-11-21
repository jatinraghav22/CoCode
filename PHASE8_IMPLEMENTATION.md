# CoCode Phase 8 — Advanced IDE & Developer Experience

## Overview

Phase 8 elevates CoCode from a basic web code editor into a comprehensive, professional, developer-focused IDE. It introduces nested folder and file management, multi-tab editing in Monaco, find/replace and project-wide search, language-aware document formatting, a secure sandboxed terminal console foundation, debounced autosave, comprehensive keyboard shortcuts, and a command palette.

---

## 1. Features Implemented

### Phase 8.1: Architecture Audit & Planning
- Performed thorough audit of frontend and backend architecture:
  - Monaco editor state, mounting, themes, and Yjs CRDT binding.
  - Backend V2 project and file management services, validation, and authorization.
  - Evaluated Prisma data models (`Project`, `ProjectFile`). Confirmed that folder hierarchies can be seamlessly represented via hierarchical file paths (e.g., `/src/components/Navbar.jsx`) and empty folder placeholders (`.cocode-keep`), requiring zero destructive database schema changes and preserving 100% backward compatibility with Phase 7.

### Phase 8.2: Advanced File Explorer
- **Nested Tree Explorer (`FileTree.jsx`)**:
  - Full recursive tree view rendering multi-level nested folders and files.
  - Expand/collapse folders with chevron indicators and persistent state in localStorage.
  - Create file and create folder at root or inside any folder.
  - Rename files and folders (recursively updates paths of all nested files).
  - Delete files and folders with safe confirmation modal (`ConfirmModal.jsx`).
  - File-type icons based on extension/language (JavaScript, TypeScript, Python, C++, C, HTML, CSS, JSON, Markdown).
  - Right-click context menus with actions: "New File", "New Folder", "Rename", "Copy Relative Path", "Delete", "Open in Tab".
  - Active file highlighting and unsaved changes indicator dot.
  - Normalization of paths, path traversal rejection (`..`), and duplicate path prevention on backend.

### Phase 8.3: Multi-Tab Monaco Editor
- Multiple open files displayed in a clean tab bar above Monaco.
- Switching between tabs preserves editor undo/redo stacks, cursor positions, and content without unmounting Monaco instances.
- Individual tab close button (`X`) with confirmation protection when unsaved changes exist.
- "Close All Tabs" command.
- Active tab indicator and modified file indicator (dirty changes dot).
- Language mode automatically restored for each file (JavaScript, Python, C++, C, Java, HTML, CSS, JSON, Markdown).
- Preserves Phase 6 real-time Yjs CRDT collaboration when operating in a room (`roomId`).

### Phase 8.4: Find, Replace and Project-Wide Search
- **Find and Replace Overlay (`FindReplaceWidget.jsx`)**:
  - Floating Find & Replace bar docked in the editor workspace.
  - Find query and Replace query inputs.
  - Toggles for Match Case (`Aa`), Whole Word (`\b`), and Regular Expressions (`.*`).
  - Next match / Previous match navigation with match count (`X of Y matches`).
  - Single replace and Replace All capabilities.
  - Keyboard friendly: Enter for next, Shift+Enter for previous, Escape to dismiss.
- **Project-Wide Search Panel**:
  - Sidebar Search tab (`Ctrl+Shift+F`) querying across all project files.
  - Server-side search API `GET /api/projects/:id/search?q=...` with client-side fallback.
  - Shows file names, line numbers, and matching text snippets.
  - Clicking on a search result opens the file, centers on the line, and positions the cursor.

### Phase 8.5: Code Formatting and Diagnostics
- **Document Formatting**:
  - Integrated with Monaco formatting provider (`Alt+Shift+F` or Command Palette).
  - Optional "Format on Save" setting.
  - Non-blocking execution with clear user feedback via toast notifications.
- **Diagnostics**:
  - In-editor syntax error detection and gutter markers for JavaScript, CSS, HTML, and JSON.
  - Output display in bottom panel.

### Phase 8.6: Integrated Terminal Foundation
- **Security-First Execution Console (`TerminalConsole.jsx`)**:
  - Resizable and collapsible bottom panel with drag resizer.
  - Interactive terminal prompt (`cocode@ide:~$ `) with command history (Up / Down arrows).
  - **Zero Host Shell Access**: Strictly prohibits arbitrary `child_process.exec` or host shell commands.
  - Built-in safe developer commands:
    - `run`: Compiles and executes the current file via Judge0 sandbox.
    - `ls` / `dir`: Lists project files and directories.
    - `cat <filename>`: Displays file content.
    - `status`: Displays workspace status, language, and sandbox connection.
    - `clear` / `cls`: Clears terminal screen.
    - `node` / `python`: Runs active code with respective compiler runtime.
    - `echo <args>`: Prints text.
    - `date`: Prints UTC timestamp.
    - `whoami`: Displays authenticated developer identity.
    - `help`: Lists all available commands.
  - Multiple bottom panel tabs: "Terminal", "Output" (Judge0 stdout/stderr), "Input (stdin)", "Execution History".

### Phase 8.7: Autosave, Keyboard Shortcuts and Command Palette
- **Autosave**:
  - Configurable autosave toggle and debounce delay (1.0s, 1.5s, 3.0s).
  - Visual save state indicator in top header: `Saved`, `Saving...`, `Unsaved`, `Save Error`.
  - Manual save (`Ctrl+S`) and Save All (`Ctrl+Shift+S`) via `PUT /api/projects/:id/save-all`.
- **Command Palette (`CommandPalette.jsx`)**:
  - Accessible via `Ctrl+Shift+P` or `F1`.
  - Filterable search for IDE commands (File, Edit, View, Run, Settings).
  - Keyboard navigation (Up/Down arrows, Enter to execute, Escape to dismiss).
- **Quick Open (`QuickOpen.jsx`)**:
  - Accessible via `Ctrl+P`.
  - Fast file search across the project with instant tab opening.
- **Preferences**:
  - Theme, font size, tab size, word wrap, minimap, autosave, format on save persisted in `localStorage`.

### Phase 8.8: UI Polish, Responsiveness & Verification
- Dark developer-tool aesthetics matching CoCode branding.
- Collapsible sidebar and bottom panel for laptop and tablet viewports.
- 100% passing test suite across all modules.

---

## 2. API Endpoints Added in Backend V2

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/projects/:id/folders` | Creates nested folder (via placeholder marker) |
| `PUT` | `/api/projects/:id/folders` | Renames folder and recursively moves nested files |
| `DELETE` | `/api/projects/:id/folders?path=...` | Deletes folder and all nested files |
| `GET` | `/api/projects/:id/search?q=...` | Searches text across all project files |
| `PUT` | `/api/projects/:id/save-all` | Batch saves multiple modified files in one call |

All endpoints require JWT authentication and enforce strict project ownership validation.

---

## 3. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Ctrl + S` | Save current active file |
| `Ctrl + Shift + S` | Save all open modified files |
| `Ctrl + P` | Quick Open file search |
| `Ctrl + Shift + P` / `F1` | Open Command Palette |
| `Ctrl + F` | Find in current file |
| `Ctrl + H` | Replace in current file |
| `Ctrl + Shift + F` | Search across project |
| `Ctrl + B` | Toggle File Explorer sidebar |
| `Ctrl + \`` | Toggle bottom Terminal panel |
| `Alt + Shift + F` | Format Document |
| `Ctrl + Enter` | Run active file via Judge0 |
| `Ctrl + W` | Close current tab (with unsaved changes protection) |

---

## 4. Security & Safety Model

1. **Terminal Foundation**:
   - The terminal is a safe execution console interface. It does not spawn host operating system processes, PowerShell, CMD, or bash on the server.
   - Code execution is routed strictly to the isolated Judge0 compiler sandbox (`/api/compiler/run`).
2. **Path Traversal Protection**:
   - `sanitizePath` and `sanitizeFolderPath` reject any paths containing `..` or illegal characters with HTTP 400.
3. **Project Isolation**:
   - All folder, file, and search requests verify `project.userId === req.userId`. Access attempts across users return HTTP 403.
4. **No AI Provider Bloat**:
   - In accordance with Phase 8 instructions, no paid external AI services (OpenAI, Gemini) were introduced.

---

## 5. Verification Results

### Backend V2 Tests (`server-v2`)
- **Node Test Runner**: `npm --prefix server-v2 test`
- **Result**: **158 passed**, 3 skipped (TiDB integration skipped when remote TiDB gateway is unreachable), **0 failed**.
- Includes 11 dedicated Phase 8 & 8.9 tests in `server-v2/tests/phase8.test.js`:
  - `Phase 8 - Folder Management API - create nested folder` (PASSED)
  - `Phase 8 - Folder Management API - rejects path traversal in folder path` (PASSED)
  - `Phase 8 - Folder Management API - rename folder recursively moves nested files` (PASSED)
  - `Phase 8 - Folder Management API - delete folder recursively deletes nested files` (PASSED)
  - `Phase 8 - Project-wide Search API - searches matches across project files` (PASSED)
  - `Phase 8 - Batch Save API - saves multiple modified files in one call` (PASSED)
  - `Phase 8 - Security & Ownership - other user cannot access project search or folders` (PASSED)
  - `Phase 8.9 - Save All Integrity - rejects nonexistent or invalid file ID with 404` (PASSED)
  - `Phase 8.9 - Save All Integrity - rejects file belonging to another project with 404` (PASSED)
  - `Phase 8.9 - Save All Integrity - rejects oversized file with 413` (PASSED)
  - `Phase 8.9 - Save All Integrity - rolls back all file updates when an error occurs during batch` (PASSED)
- **Syntax Check**: `npm --prefix server-v2 run check` passed cleanly.

### Frontend Build (`client`)
- **Vite Production Build**: `npm --prefix client run build`
- **Result**: Built successfully in 2.64s. 3287 modules transformed, 0 errors.

---

## 6. Phase 8.9 — Editor Reliability & Save Integrity Fixes

### Task 1: Save & Autosave Race Condition Resolution
- **Dynamic Content Resolution**: `getLatestFileContent()` resolves live text from Monaco models (`editor.getModel().getValue()`) first, falling back to memory refs, avoiding stale React state closures.
- **Per-File Debounced Autosave**: Autosave timers are tracked in `autoSaveTimersRef` mapped by `fileId`. Even if the developer switches active tabs before the debounce timer elapses, the scheduled timer saves the exact file that was modified.
- **Revision Counters & In-Flight Queuing**: Each file tracks its `fileVersionRef` and `fileSavedVersionRef`. If edits occur while a save HTTP request is in-flight, `fileNeedsReSaveRef` is flagged, preserving dirty state until subsequent saves commit the newest revision. An older HTTP response can never clear a newer dirty state.
- **Save Status Accuracy**: Distinct indicators for `saving`, `saved`, `unsaved`, and `error`. Failed requests keep dirty state intact.
- **Unmount Timer Cleanup**: An unmount effect clears all pending autosave timers in `autoSaveTimersRef`.

### Task 2: Save All Integrity
- **Frontend Snapshot Matching**: `saveAllFiles()` captures exact content and version snapshots before firing the request. Upon completion, dirty flags are only cleared for files whose version has not changed while the request was in-flight. Standalone local projects follow identical semantics.
- **Backend Prisma Transactions**: `saveAllFiles()` in `server-v2/src/modules/projects/project.service.js` executes inside `this.prisma.$transaction`.
- **Strict Upfront Validation**: Verifies project ownership, confirms every file ID belongs to the project (throwing 404 on nonexistent or cross-project file IDs), rejects oversized files with 413, and normalizes languages before writing.
- **Atomic Rollback**: Any error during batch execution triggers a full transaction rollback, preventing partial saves.

### Task 3: Monaco Editor Lifecycle & View State Preservation
- **Single Stable Editor Instance**: Replaced dynamic key with `key="cocode-monaco-editor"`, preventing editor unmounting and remounting on tab switch.
- **Path-Based Models**: Uses `path={activeFile.path || activeFile.id}`. Monaco retains separate models with individual undo/redo stacks per file.
- **View State Caching & Restoration**: Tab transitions and file openings cache `editor.saveViewState()` in `viewStatesRef` and restore it with `editor.restoreViewState()` upon switching, preserving cursor positions, text selections, and scroll offsets.
- **Phase 6 Yjs Collaboration**: The collaborative room effect dynamically binds to the active file's Monaco model, cleanly destroying previous bindings and document update listeners without tearing down the editor instance.
