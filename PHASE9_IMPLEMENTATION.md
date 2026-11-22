# CoCode Phase 9 — Complete Production Readiness, Security, Reliability & Performance

## Overview

Phase 9 transforms CoCode into an enterprise-grade, secure, performant, and resilient cloud IDE and real-time collaborative development platform. All previous architectural capabilities (Phases 1 through 8, including Phase 8 advanced IDE, Monaco bindings, integrated terminal, file tree, search, and batch persistence) have been preserved and verified against regressions.

---

## 1. Architecture & Security Audit Findings

Prior to implementation, an exhaustive audit was performed across frontend, backend-v2, database interactions, Socket.IO real-time channels, and Judge0 compiler services:

| Component | Audit Finding | Severity | Resolution in Phase 9 |
|---|---|---|---|
| **Health Checks** | Only basic `/api/health` existed; no dependency readiness probe `/api/ready` to evaluate database availability without exposing internals. | High | Implemented `/api/ready` probe executing non-blocking SQL ping with safe timeout, `clearTimeout` on success/error, 503 when `$queryRaw` is missing or fails, and no internal detail leakage. |
| **Error Handling** | Unhandled Prisma exceptions and malformed JSON payloads either resulted in generic 500 errors or leaked database exceptions. Auth controller exposed internal messages for 5xx errors. | High | Implemented centralized error middleware mapping Prisma error codes (`P2002` → 409, `P2025` → 404, `P2003` → 400, connection failure → 503); 5xx errors return generic `"Internal server error."` only; 4xx errors preserve client-facing messages. Auth controller now only surfaces 4xx error messages, routing 5xx to the centralized handler. |
| **Proxy Trust** | `trust proxy` was not configurable; could misinterpret `req.ip` behind reverse proxies or silently trust spoofed headers. | High | Added `TRUST_PROXY` environment variable with safe parsing (supports `false`, `true`, numeric hop count, or subnet string). Defaults to `false` (no trust) in development. |
| **Rate Limiting** | Write endpoints such as project creation (`POST /api/projects`) and project save-all (`PUT /api/projects/:id/save-all`) lacked rate limiting. | Medium | Added dedicated rate limiters for project creation (30/15 min) and batch file saves (120/min per user). |
| **Compiler Outputs** | Judge0 responses were decoded from Base64 without length boundaries, presenting memory exhaustion and frontend freeze risks if infinite print loops occurred. | High | Introduced output bounding (max 100 KB per field) with user-friendly truncation notices for `stdout`, `stderr`, `compileOutput`, and `message`. |
| **Judge0 Polling** | Individual requests had timeouts, but multi-attempt polling loops could run up to 150 seconds with no overall deadline. | High | Added `totalTimeoutMs` overall execution deadline (default 15s, configurable 3–60s). Added `Content-Length > 2MB` guard on upstream responses. Added HTTP 400/401/403/429/5xx handling. Validated all timeout/poll config bounds in constructor. |
| **Socket.IO Events** | No per-socket rate limiting; async handlers (e.g. `room:sync`) lacked `try/catch`, causing `unhandledRejection` on DB errors. | Medium | Added sliding-window per-socket rate limiters for `chat` (15/5s), `yjs` (150/5s), `code` (40/5s), `join` (10/10s), `sync` (6/10s). Wrapped `room:sync` in `try/catch`. |
| **Batch Save** | `saveAllFiles` had no upper bound on the number of files per batch. | Medium | Added `MAX_BATCH_FILES = 50` validation, rejecting requests exceeding the limit with HTTP 400. |
| **Project Search** | Query regex allowed arbitrary length queries and unbounded match counts on large files. | Low | Added 200-character query clipping and maximum 1,000 matches cap to protect Node event loop. |
| **Frontend Crash Protection**| React component tree had no root Error Boundary, causing white screens on unhandled runtime errors. | High | Added dark-themed `ErrorBoundary` with page reload, dashboard navigation, and collapsible diagnostic details. |
| **Frontend Tests** | Client repository lacked automated test scripts. | Medium | Added Node native test runner (`node --test`) with tests for URL normalization, token storage, route redirection, tab management, file tree sorting, and error handling. |
| **Graceful Shutdown** | Room hydration operations in progress and dirty room saves lacked unified deadline bounding. | High | Entire flush operation is subject to a single bounded deadline covering in-progress room hydration (`_loadingPromises`) and database saves. Returns `{ success, unsaved, timedOut }`. Shutdown coordination enforces an overall 20-second timeout with force-exit safety net, sequential teardown (Socket.IO → Flush → Prisma disconnect), and unhandled rejection policy with nonzero exit. |

---

## 2. Security Improvements

1. **API Security Headers & Deployment-Aware Reverse Proxy Support**:
   - Added `TRUST_PROXY` environment variable with safe parsing:
     - `false` / `0` → no proxy trusted (default)
     - `true` → trust all proxies
     - Numeric string (e.g. `1`) → trust that many hops
     - String (e.g. `loopback`, subnet CIDR) → passed directly to Express
   - Express `trust proxy` only set when explicitly configured; defaults to `false`.
   - Enforced `helmet()` security headers with disabled `x-powered-by` header.
   - Refined CORS error handling to return standardized 403 Forbidden.

2. **Request Body Size Restrictions**:
   - `express.json` and `express.urlencoded` limit set to `5mb`.
   - Payloads exceeding size limits immediately receive HTTP 413 Payload Too Large.

3. **Granular HTTP Rate Limiting**:
   - `POST /api/auth/register`: 10 attempts per 15 minutes per IP.
   - `POST /api/auth/login`: 20 attempts per 15 minutes per IP.
   - `PATCH /api/users/me/password`: 15 attempts per 15 minutes per IP.
   - `POST /api/compiler/run`: 20 executions per minute per user/IP.
   - `POST /api/rooms`: 10 room creations per 15 minutes per IP.
   - `POST /api/rooms/join`: 30 room joins per 15 minutes per IP.
   - `POST /api/projects`: 30 project creations per 15 minutes per user/IP.
   - `PUT /api/projects/:id/save-all`: 120 batch saves per minute per user.
   - Standardized headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`.

4. **Per-Socket Rate Limiting** (single-process, in-memory):
   - `chat`: 15 messages per 5 seconds per socket.
   - `yjs:update`: 150 updates per 5 seconds per socket.
   - `code:update`: 40 updates per 5 seconds per socket.
   - `room:join`: 10 joins per 10 seconds per socket.
   - `room:sync`: 6 syncs per 10 seconds per socket.
   - Counters are per-connection and reset on reconnection. Not shared across processes.

5. **Resource Authorization & Data Isolation**:
   - Maintained verified database authorization on all user routes, room operations, and project files.
   - Non-members are strictly forbidden from reading or altering projects or collaboration rooms.
   - Password hashes are never selected or returned in any API response.

---

## 3. Backend Reliability & Error Handling

1. **Liveness & Readiness Endpoints**:
   - `GET /api/health`: Fast liveness check verifying server uptime and process health.
   - `GET /api/ready`: Deep readiness probe running `prisma.$queryRaw\`SELECT 1\`` with a 4-second timeout.
     - Returns HTTP 503 if `prisma` is missing or `$queryRaw` is not a function (checks: `"unavailable"`).
     - Returns HTTP 503 if the database query fails or times out (checks: `"unreachable"`).
     - `clearTimeout` is called in both success and error paths to prevent timer leaks.
     - Returns HTTP 200 when database is healthy (checks: `"healthy"`).
     - Never exposes connection URLs, passwords, hostnames, or internal stack traces.

2. **Centralized Error Middleware**:
   - Catch-all middleware maps exceptions into uniform JSON structures:
     - `P2002` (Unique constraint): HTTP 409 Conflict.
     - `P2025` (Record not found): HTTP 404 Not Found.
     - `P2003` (Foreign key violation): HTTP 400 Bad Request.
     - `P2024` / `PrismaClientInitializationError`: HTTP 503 Service Unavailable.
     - `SyntaxError` (Malformed JSON request): HTTP 400 Bad Request.
     - `entity.too.large`: HTTP 413 Payload Too Large.
     - 4xx client errors: preserve the error message for the client.
     - 5xx internal errors: return generic `"Internal server error."` only. Server-side log sanitizes Bearer tokens, passwords, and password hashes before writing to stderr.
   - Auth controller login handler routes errors with `statusCode >= 500` to `next()` for centralized handling, preventing accidental internal message leakage.

3. **Graceful Shutdown & Process Resilience**:
   - In `server-v2/src/server.js`, implemented `createShutdownHandler` providing a shared in-progress shutdown promise across all concurrent callers (`SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection`).
   - Every caller of `shutdown()` receives the exact same in-progress promise instance.
   - If an unhandled rejection or uncaught exception occurs while a graceful shutdown is already underway, it sets the failure exit code (`exitCode = 1`) without terminating the process before the existing teardown completes.
   - Removed `.finally(() => process.exit(1))` on duplicate calls, preventing premature process termination during active teardown.
   - An overall shutdown deadline (`SHUTDOWN_DEADLINE_MS = 20000`, 20 seconds) is enforced with a force-exit timer safety net that triggers `process.exit(1)` if teardown hangs. The timer is cleared upon successful shutdown.
   - Sequential shutdown coordination:
     1. Locks room store (`setShuttingDown(true)`) to reject new collaboration writes immediately.
     2. Closes Socket.IO and HTTP server via `io.close()` with dynamic timeout budgeted from remaining shutdown time (up to 8 seconds). Timeout timer is cleared on completion.
     3. Flushes all pending room document saves with `flush(null, { timeoutMs })` budgeted from remaining shutdown time (minus a 1-second safety buffer for Prisma). Entire flush (hydration wait + dirty file saves) runs under this single deadline. Reports both still-hydrating rooms and dirty files in loaded rooms without returning early. Note: `Promise.race` bounds the shutdown wait, but does not cancel in-flight database requests on the database server.
     4. Disconnects Prisma client only if the flush did not time out. If flush timed out, outstanding hydration or save operations may still be running against Prisma; premature disconnection is prevented to allow in-flight operations to settle without failing. If flush completed normally (success or completed save errors without timing out), Prisma disconnects normally.
     5. Exits with code 1 if any step fails or times out; exits with code 0 on clean completion.
   - **Unhandled Rejection Policy**:
     - Sanitizes log output, redacting Bearer tokens, passwords, and secrets.
     - Sets failure exit status and initiates coordinated graceful shutdown.
   - **Uncaught Exception Policy**:
     - Logs sanitized error details, runs bounded shutdown, and exits with code 1.

---

## 4. Socket.IO & Yjs Collaboration Reliability

1. **Handshake & Room Authorization**:
   - Verified JWT signature, issuer, and audience before granting socket connection.
   - Re-verified database room membership via `roomService.isParticipant` before admitting socket to room channel.

2. **Binary Yjs Update Validation**:
   - Robust type guards check incoming `yjs:update` payloads before calling `roomStateStore.applyYjsUpdate`.
   - Non-array and non-Uint8Array inputs are rejected safely without crashing the event loop.
   - Updates exceeding `MAX_UPDATE_BYTES` (500 KB) trigger a `room:error` notification.

3. **Async Event Error Safety**:
   - `room:sync` handler wrapped in `try/catch` to prevent `unhandledRejection` on DB errors.
   - On error, emits `room:error` with safe message `"Failed to synchronize room state."`.

4. **Echo Prevention & Multi-Channel Stability**:
   - Preserved CRDT convergence: `yjs:update` broadcasts exclusively to other sockets in the room.
   - Text updates via `code:update` generate corresponding binary Yjs updates to maintain convergence.

---

## 5. Judge0 Compiler Security & Reliability

1. **Output Size Clamping**:
   - Enforced `MAX_OUTPUT_LENGTH = 100 * 1024` (100 KB) per field.
   - Truncated fields append `\n... [output truncated: exceeded maximum display limit]`.

2. **Total Execution Deadline**:
   - `totalTimeoutMs` (default 15,000 ms, configurable 3,000–60,000 ms) bounds the entire submission + poll cycle.
   - `overallDeadline = Date.now() + this.totalTimeoutMs` checked before each poll iteration.
   - Poll sleep and request timeout are clamped to remaining deadline.

3. **Constructor Parameter Validation**:
   - `timeoutMs`: valid range 1,000–60,000 ms, default 10,000 ms.
   - `pollIntervalMs`: valid range 100–5,000 ms, default 750 ms.
   - `maxPollAttempts`: valid range 1–60, default 15.
   - `totalTimeoutMs`: valid range 3,000–60,000 ms, default 15,000 ms.
   - Out-of-range or non-finite values silently fall back to defaults.

4. **Upstream Response Safety & Streaming Body Limit**:
   - Implemented real byte limit enforcement (`_readBoundedJson`) while reading chunks from response streams (`body.getReader()`), rejecting responses exceeding `maxResponseBodyBytes` (default 2 MB) immediately before buffering or parsing JSON.
   - Never calls `.text()` or `.json()` in a way that buffers an unbounded response before checking its size.
   - If a response has no readable streaming body and no trustworthy bounded-reading mechanism, fails safely with a sanitized `UpstreamError` without buffering.
   - Cancels oversized response streams (`reader.cancel()`) and handles cancellation errors safely.
   - Early rejection via `Content-Length` header when present and exceeding limit, cancelling any associated stream.
   - Rejection occurs even when `Content-Length` header is absent, inaccurate, or when chunked transfer encoding is used.
   - HTTP 429 → `ServiceUnavailableError` (503).
   - HTTP 401/403 → `UpstreamError` (502, "authentication failed").
   - HTTP 400 → `UpstreamError` (400, "rejected submission parameters").
   - Other non-OK → `UpstreamError` (502).
   - Invalid JSON response → `UpstreamError` with safe sanitized context.
   - Malformed response stream / network reset → `UpstreamError` without exposing credentials or internal URLs.

5. **Existing Limits Preserved**:
   - Source code: 30,000 characters.
   - Standard input: 10,000 characters.
   - CPU time: 2 seconds.
   - CPU extra time: 1 second.
   - Wall time: 5 seconds.
   - Memory: 128,000 KB.

---

## 6. Database and Performance Optimization

1. **Pagination & Query Efficiency**:
   - `ProjectService.listProjects` uses `skip` and `take` pagination.
   - `ActivityService.getActivities` uses pagination bounded between 1 and 100 items per page.
   - Preserved all optimal Prisma indexes.

2. **Search Performance**:
   - `ProjectService.searchProjectFiles`: bounded to 200 characters and 1,000 matches.

3. **Batch Save Bounded**:
   - `saveAllFiles` rejects batches exceeding `MAX_BATCH_FILES = 50` with HTTP 400.

4. **Zero Destructive Migrations**:
   - No schema changes or table drops were performed.

---

## 7. Frontend Reliability & Performance

1. **React Error Boundary**:
   - Created `client/src/components/ErrorBoundary.jsx` styled to match the dark Arctic/Violet design system.
   - Provides recovery options: "Reload Page", "Return to Dashboard", and collapsible technical error stacks.
   - Wrapped top-level application routing in `client/src/main.jsx`.

2. **Code Cleanliness & Performance**:
   - Cleaned up unused imports in `TerminalConsole.jsx`, `CommandPalette.jsx`, and `QuickOpen.jsx`.
   - Memoized `handleRunCode` in `EditorPage.jsx` with `useCallback`.
   - Resolved Fast Refresh linting warnings in `ThemeContext.jsx`.
   - Production Vite build completes in ~2.9 seconds.

3. **Editor Protection**:
   - Retained full Monaco editor lifecycle, cursor preservation, multi-tab switching, recursive file tree, integrated sandboxed terminal, find & replace, project search, formatting, and Save All reliability.

---

## 8. Automated Testing & Verification Results

### Backend V2 Test Suite (`server-v2`)
- **Total Tests**: 218
- **Passed**: 215
- **Failed**: 0
- **Skipped**: 3 (External integration tests requiring live TiDB Cloud and Judge0 keys)
- **Syntax Check (`node --check`)**: Passed (100% of modules validated)

### Phase 9 Production Tests (`server-v2/tests/phase9.production.test.js`)
Tests specifically verifying Phase 9 hardening (57 test cases):
1. `GET /api/ready` returns 200 when database is healthy
2. `GET /api/ready` returns 503 when database is unreachable
3. `GET /api/ready` returns 503 when `prisma.$queryRaw` is missing
4. `GET /api/ready` returns 503 when `$queryRaw` is not a function
5. Centralized error handler rejects malformed JSON payloads with 400
6. Centralized error handler maps Prisma P2002 to 409 Conflict
7. Centralized error handler maps Prisma P2025 to 404 Not Found
8. Centralized error handler maps DB initialization failure to 503
9. Centralized error handler masks 500 internal errors (returns `"Internal server error."`)
10. Centralized error handler preserves 4xx client error messages
11. Trust proxy defaults to false when unset
12. Trust proxy applies configured numeric value
13. Trust proxy applies configured string value
14. Judge0 output truncation bounds huge stdout to 100 KB
15. Judge0 network failure throws `UpstreamError` cleanly
16. Judge0 HTTP 429 throws `ServiceUnavailableError`
17. Judge0 HTTP 401/403 throws `UpstreamError` with 502
18. Judge0 oversized streamed body with Content-Length throws `UpstreamError`
19. Judge0 oversized streamed body without Content-Length throws `UpstreamError`
20. Judge0 missing body with `.text()` only throws `UpstreamError`
21. Judge0 missing body with `.json()` only throws `UpstreamError`
22. Judge0 stream interruption throws `UpstreamError`
23. Judge0 malformed JSON throws `UpstreamError`
24. Judge0 reader cancellation on oversized body
25. Judge0 normal bounded response parses successfully
26. Judge0 total deadline bounds multi-attempt polling
27. Judge0 constructor validates timeout bounds
28. Judge0 `normalizeResult` handles null/undefined input safely
29. `saveAllFiles` accepts up to 50 files
30. `saveAllFiles` rejects more than 50 files with 400
31. Project search bounds query string and caps maximum matches
32. Rate limiter correctly tracks requests and blocks over limit
33. Rate limiter allows requests within limit
34. Socket-level rate limiter allows within limit and blocks over
35. `RoomStateStore.flush`: normal successful flush with no dirty files
36. `RoomStateStore.flush`: awaits loading promises before flushing
37. `RoomStateStore.flush`: one hung hydration plus one already-loaded room with a dirty file reports both
38. `RoomStateStore.flush`: multiple loaded dirty files and multiple still-loading rooms
39. `RoomStateStore.flush`: no duplicate entries in unsaved
40. `RoomStateStore.flush`: accurate success and timedOut values
41. `RoomStateStore.flush`: save that never resolves returns within deadline and reports unsaved file
42. `RoomStateStore.flush`: successful save marks file as not dirty
43. `loadEnv` parses `TRUST_PROXY` values correctly
44. `GET /api/health` returns 200 with uptime
45. Unknown API routes return 404
46. Shutdown: concurrent SIGTERM and SIGINT return the exact same in-progress promise
47. Shutdown: unhandled rejection during existing shutdown sets failure exit code without aborting flush
48. Shutdown: uncaught exception during existing shutdown sets failure exit code
49. Shutdown: genuinely hung shutdown reaching deadline triggers force-exit
50. Shutdown: timed-out save does not cause Prisma to disconnect while save remains pending
51. Shutdown: timed-out hydration does not cause Prisma to disconnect while hydration remains pending
52. Shutdown: normal successful flush disconnects Prisma
53. Shutdown: completed save failure without timeout still follows normal cleanup and disconnects Prisma
54. Shutdown: normal successful shutdown exits with 0 and clears force-exit timer
55. Shutdown: shutdown failure produces nonzero exit status
56. Unhandled rejection handler sanitizes sensitive information
57. Unhandled rejection handler treats non-Error reasons safely

### Frontend Test Suite (`client`)
- **Total Tests**: 6
- **Passed**: 6
- **Failed**: 0
- **Skipped**: 0
- **Build (`vite build`)**: Passed (All chunks rendered successfully, 2.9s)
- **Lint (`oxlint`)**: 0 errors, 66 warnings (pre-existing style advisories)

---

## 9. CI/CD Configuration

Created `.github/workflows/ci.yml` providing automated verification on pushes and pull requests to `main`:

1. Sets up Node.js 20 environment.
2. Installs frontend dependencies via `npm ci` (working-directory: `client`).
3. Runs frontend linting via `npm run lint` (working-directory: `client`).
4. Runs frontend test suite via `npm test` (working-directory: `client`).
5. Builds frontend production bundle via `npm run build` (working-directory: `client`).
6. Installs backend dependencies via `npm ci` (working-directory: `server-v2`).
7. Generates Prisma client via `npx prisma generate --schema=prisma/schema.prisma` (working-directory: `server-v2`).
8. Validates backend JavaScript syntax via `npm run check` (working-directory: `server-v2`).
9. Executes backend test suite via `npm test` (working-directory: `server-v2`).

---

## 10. Production Configuration Requirements

### Backend (`server-v2`)

```env
PORT=5000
NODE_ENV=production
CLIENT_ORIGIN=https://www.getcocode.app,https://cocode.app
DATABASE_URL="mysql://<user>:<password>@<tidb-host>:4000/cocode?sslaccept=strict"
JWT_SECRET="<random_secret_at_least_32_characters_long>"
JWT_EXPIRES_IN=7d
JWT_ISSUER=cocode-backend-v2
JWT_AUDIENCE=cocode-client
JUDGE0_BASE_URL=https://ce.judge0.com
JUDGE0_API_KEY=""
JUDGE0_TIMEOUT_MS=10000
JUDGE0_POLL_INTERVAL_MS=750
JUDGE0_MAX_POLL_ATTEMPTS=15
JUDGE0_TOTAL_TIMEOUT_MS=15000
JUDGE0_USE_BASE64=true
```

#### Proxy Trust Configuration

Set `TRUST_PROXY` based on your deployment's reverse proxy topology:

| Deployment Topology | Recommended Value | Explanation |
|---|---|---|
| Direct / Local development | _(unset or `false`)_ | No reverse proxy; `req.ip` reads socket directly |
| Single reverse proxy / Load balancer | `1` | Behind a single reverse proxy, ingress, or cloud load balancer |
| Multi-hop proxy (e.g. CDN → Ingress) | `2` or `loopback` | Two proxy hops before reaching Node |
| Custom reverse proxy chain | Number of trusted hops | Match your trusted proxy chain depth |

> **Important**: Do not guess your deployment's proxy topology. Setting this incorrectly can cause IP-based rate limiting to use spoofed addresses. When in doubt, leave it unset (defaults to `false`).

### Frontend (`client`)

```env
VITE_API_URL=https://<your-backend-domain>
```

---

## 11. Files Modified in Phase 9

### New Files Created
| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `client/src/components/ErrorBoundary.jsx` | React error boundary component |
| `client/tests/frontend.test.js` | Frontend automated tests (6 tests) |
| `server-v2/tests/phase9.production.test.js` | Phase 9 production hardening tests (57 tests) |
| `PHASE9_IMPLEMENTATION.md` | This documentation |

### Modified Files
| File | Changes |
|---|---|
| `client/package.json` | Added `"test": "node --test"` script |
| `client/src/ThemeContext.jsx` | Fixed Fast Refresh warning |
| `client/src/components/ide/CommandPalette.jsx` | Removed unused imports |
| `client/src/components/ide/QuickOpen.jsx` | Removed unused import |
| `client/src/components/ide/TerminalConsole.jsx` | Removed unused imports |
| `client/src/main.jsx` | Wrapped app in ErrorBoundary |
| `client/src/pages/EditorPage.jsx` | Memoized `handleRunCode` |
| `server-v2/src/app.js` | Readiness probe, trust proxy, centralized error handler |
| `server-v2/src/config/env.js` | `TRUST_PROXY` parsing, Judge0 config validation |
| `server-v2/src/modules/auth/auth.controller.js` | Route 5xx errors to `next()` for centralized handling |
| `server-v2/src/modules/compiler/judge0.service.js` | Enforce real streaming response body reader `_readBoundedJson`, reject missing/unbounded bodies, cancel oversized streams |
| `server-v2/src/modules/projects/project.service.js` | `MAX_BATCH_FILES = 50` validation |
| `server-v2/src/modules/rooms/room.store.js` | Bounded `flush()` with overall deadline, reports both hung hydration rooms and dirty loaded files, `{ success, unsaved, timedOut }` |
| `server-v2/src/routes/project.routes.js` | Rate limiters for project creation and save-all |
| `server-v2/src/server.js` | Shared in-progress shutdown promise (`createShutdownHandler`), rejection safety, prevents premature Prisma disconnect on timeout, force-exit safety net |
| `server-v2/src/socket.js` | Per-socket rate limiting, `room:sync` try/catch |
| `server-v2/tests/compiler.test.js` | Converted mock Judge0 responses to standard streaming mocks |

### Untouched Files
- Legacy `server/` directory: 7 pre-existing uncommitted files preserved exactly as-is.
- No database schema migrations performed.

---

## 12. Rollback Considerations

If a rollback of Phase 9 changes is required:
- No database migrations were performed, so rollback involves only code deployment without database state restoration.
- Legacy `server/` was preserved in its exact pre-existing state throughout this implementation.

---

## 13. Known Limitations

1. **Per-socket rate limiters are in-memory and per-process**: Counters reset on reconnection and are not shared across multiple server processes. For multi-process deployments, consider Redis-backed rate limiting.
2. **Readiness probe timeout does not cancel the Prisma query**: Node.js and the Prisma query engine do not support query cancellation. The `Promise.race` timeout ensures the HTTP response is sent promptly, but the underlying query may continue running until it completes or the connection drops.
3. **Frontend lint warnings (66)**: Pre-existing oxlint style advisories (mostly `set-state-in-effect` and unused Lucide imports in `FindReplaceWidget.jsx`). Zero errors.
4. **Room flush timeout does not cancel Prisma database operations**: `Promise.race` enforces bounded shutdown waiting time so a hung database query does not stall process termination indefinitely. However, JavaScript promises do not cancel underlying network requests on the database server. When a flush times out, Prisma disconnect is intentionally skipped during shutdown to avoid prematurely severing connections for in-flight operations, and process termination via the overall shutdown deadline provides the final safety boundary.
5. **Streaming body limit and cancellation**: Response bodies must provide a readable stream (`body.getReader()`). Responses without a readable streaming body are rejected with an `UpstreamError` before any unbounded data is buffered into memory. When an oversized body is detected while streaming, `reader.cancel()` is immediately invoked to cease downstream chunk consumption.
