# CoCode Project Tracker

## Project
CoCode - Cloud-Based Unified Real-Time Collaborative Code Editor

## Architecture
- Frontend: Existing React + Vite + JavaScript
- Backend V2: Node.js + Express + JavaScript
- Database: Fresh TiDB Cloud database
- ORM: Prisma
- Authentication: JWT + bcrypt
- Real-time: Socket.IO
- Compiler: Judge0
- Frontend deployment: Vercel
- Backend deployment: Render

## Preservation Rules
- Preserve all existing client files and features.
- Preserve the existing server directory and its files.
- Do not reset or delete the local MySQL database.
- Backend V2 must be developed independently in server-v2.
- Do not expose database credentials or JWT secrets.
- Do not replace the production backend until integration and testing are complete.

## Development Progress

| Phase | Description | Status |
|---|---|---|
| 0 | Repository and frontend audit | Complete |
| 1 | Backend V2 foundation and health API | Complete |
| 2 | TiDB and Prisma connection | Complete |
| 3 | Authentication and user model | Complete |
| 4 | Profile and account APIs | Complete |
| 5 | Coding Workspace & Compiler | Complete |
| 6 | Real-Time Collaboration (Rooms & Sockets) | Complete |
| 7 | User-specific dashboard APIs | Pending |
| 8 | Advanced Collaboration Enhancements | Pending |
| 9 | Security and validation hardening | Pending |
| 10 | Frontend deployment integration | Pending |
| 11 | Testing and bug fixing | Pending |
| 12 | Deployment | Pending |
| 13 | Production verification | Pending |

## Audit Findings
- Frontend production build: Passed.
- Frontend lint: 0 errors, 36 warnings.
- Existing frontend features must be preserved.
- Existing backend files and migrations must remain untouched.
- Uncommitted repository changes must be preserved.

## Phase 3 Notes
- Complete JWT authentication system implemented in `server-v2/` with bcryptjs password hashing and Prisma 6.19.3.
- Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- Security: In-memory sliding window rate limiting on auth endpoints, input validation (name, RFC 5322 email, password strength), generic invalid credentials on login failure, sub claim user ID, safe user projections (passwordHash never exposed).
- Testing: Comprehensive test suite using Node.js built-in test runner with 27 tests passing (including TiDB Cloud integration).
- Documentation: Detailed API documentation created in `server-v2/docs/AUTH_API.md`.

## Phase 4 Notes
- Complete Profile & Account Management API implemented in `server-v2/` with safe user projections and strict input validation.
- Endpoints: `GET /api/users/me`, `PATCH /api/users/me`, `PATCH /api/users/me/password`.
- Security: Requires JWT bearer authentication; user identity strictly derived from `req.userId` (preventing IDOR and cross-user tampering); strict allowlists rejecting unexpected update fields; email cannot be changed; passwords securely updated via bcryptjs (10 rounds); current password verification; password reuse prevention; passwords and password hashes never exposed.
- Testing: Comprehensive automated test suite in `server-v2/tests/user.test.js` covering all 16 specified requirements + edge cases, plus `server-v2/tests/user.tidb.test.js` TiDB integration test. Full test suite has 46 tests passing (with 2 network-dependent TiDB integration tests safely skipped when offline).
- Documentation: Detailed API documentation created in `server-v2/docs/USER_API.md`.

## Phase 5 Notes
- Complete Coding Workspace & Compiler module implemented in `server-v2/` with isolated remote execution via Judge0 CE.
- Endpoints: `POST /api/compiler/run`, `GET /api/compiler/languages`.
- Supported execution runtimes verified: C (GCC 14.1.0, ID 103), C++ (GCC 14.1.0, ID 105), Java (OpenJDK 17, ID 91), Python (Python 3.12, ID 100), JavaScript (Node.js 22, ID 102).
- Security & Limits: Requires JWT authentication on all compiler routes; strict payload validation (source code max 30,000 characters, stdin max 10,000 characters); per-user sliding window rate limiting (20 runs/minute); isolated Judge0 sandbox (2s CPU time limit, 5s wall-clock limit, 128 MB RAM limit, network access disabled); zero local shell/child_process execution on the CoCode Node.js backend; no logging of code, input, or credentials.
- Judge0 integration: Clean service layer handling synchronous and asynchronous polling, bounded retry loops, base64 encoding/decoding, and upstream timeout/error mapping (502, 503, 504).
- Compatibility: Responses return both the normalized Backend V2 envelope (`data: { status, stdout, stderr, compileOutput, time, memory, language }`) and top-level fields for zero-modification compatibility with the existing React frontend `Compiler.jsx`.
- Testing: Comprehensive test suite with 80 total tests across Backend V2 (77 passing, 3 network-dependent tests safely skipped when offline). Added 21 compiler unit tests (`tests/compiler.test.js`), 12 compiler integration tests (`tests/compiler.integration.test.js`), and 1 live smoke test (`tests/compiler.external.test.js`).
- Documentation: Detailed API documentation created in `server-v2/docs/COMPILER_API.md`.

## Phase 6 Notes
- Complete Production-Grade Real-Time Collaboration implemented in `server-v2/` with Socket.IO, Yjs CRDT synchronization, and Prisma TiDB Cloud models.
- Database:
  - `CollaborationRoom`: Indexed 6-character room codes, owner foreign keys, isPrivate flag.
  - `RoomParticipant`: Unique `[roomId, userId]` participant constraints, safe idempotent joins.
  - `RoomDocument`: Persistent file storage in TiDB Cloud (`@db.LongText`), unique `[roomId, fileId]`, tracks language, filename, and auto-saves code. Schema pushed to TiDB Cloud.
- REST Endpoints:
  - `POST /api/rooms` (authenticated room creation with automatic initialization of persistent default documents).
  - `POST /api/rooms/join` (race-safe, idempotent room enrollment using Prisma upsert & P2002 collision catch).
  - `GET /api/rooms/:code` (participant metadata access validation).
  - `GET /api/rooms/:code/documents` (retrieval of all persistent room documents for enrolled participants).
- Real-Time Gateway (`src/socket.js`) & Yjs Synchronization (`src/modules/rooms/room.store.js`):
  - Handshake JWT authentication verifying signature, expiration, issuer, and audience; rejects unauthenticated sockets.
  - Persistent room authorization verifying user is an enrolled participant in TiDB before joining Socket.IO rooms.
  - Yjs CRDT incremental synchronization via `yjs:update`: binary updates broadcast with echo prevention; prevents full-file overwrite conflicts and guarantees convergence across simultaneous edits.
  - Legacy `code:update` retained for backward compatibility.
  - Persistent backing: `RoomStateStore` re-hydrates `Y.Doc` state directly from TiDB `room_documents`, debounces saves (1000ms), and flushes to database on server shutdown. Full recovery after backend restart.
  - Multi-tab presence management: `user:joined`, `user:left`, and `user:presence` with multi-socket tracking per user.
  - Safe in-memory chat messaging (`chat:message`) with timestamp and sanitized user identity.
  - Rate limiting on room creation (10/15 min) and joining (30/15 min); 200 KB code payload bounds.
- Frontend Integration (`EditorPage.jsx` & `vite.config.js`):
  - Installed `yjs`, `y-monaco`, `y-protocols`.
  - Configured Vite alias for `monaco-editor` module path to resolve bundling.
  - Real-time `MonacoBinding` binding Monaco editor models to Yjs text types with conflict-free collaborative editing.
  - Real-time socket handlers for `yjs:update` and `room:joined` initial state rehydration.
  - Connection status badge (connecting, connected, reconnecting, disconnected, error).
  - Copy room ID button with visual feedback in toolbar and teams panel.
  - Graceful "Leave Room" navigation and disconnect action.
- Testing: Comprehensive test suite with 103 total tests across Backend V2 (100 passing, 3 network-dependent tests safely skipped when offline). Added 13 room management tests (`tests/room.test.js`) and 10 socket collaboration & Yjs tests (`tests/socket.test.js`).
- Documentation: Detailed architecture and API documentation created in `server-v2/docs/COLLABORATION_API.md`.
