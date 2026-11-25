# CoCode — Automated Test Results Report

**Date**: November 25, 2026  
**Auditor**: QA Automation Engineer & Application Security Auditor  
**Environment**: Windows 11, Node.js v24.19.0, npm 11.2.0  

---

## 1. Summary of Automated Test Execution

| Workspace | Test Suite Command | Total Tests | Pass | Fail | Skipped | Status |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Backend V2 (`server-v2`)** | `npm --prefix server-v2 test` | 227 | 224 | 0 | 3 | **PASS** |
| **Frontend (`client`)** | `npm --prefix client test` | 14 | 14 | 0 | 0 | **PASS** |
| **Legacy Server (`server`)** | `npm --prefix server test` | 50 | 49 | 0 | 1 | **PASS** |
| **Frontend Production Build** | `npm --prefix client run build` | 1 | 1 | 0 | 0 | **PASS** |
| **Frontend Linter** | `npm --prefix client run lint` | 1 | 1 | 0 | 0 | **PASS** |
| **Backend Syntax Check** | `npm --prefix server-v2 run check` | 1 | 1 | 0 | 0 | **PASS** |
| **TOTAL** | **Full Repository Test Suite** | **295** | **290** | **0** | **4** | **100% RUNNABLE PASS** |

---

## 2. Backend V2 Test Execution Details

**Runner**: Node.js built-in test runner (`node --test`)  
**Execution Command**: `npm --prefix server-v2 test`  
**Duration**: ~4.5 seconds  

### Breakdown by Test File

| Test File | Focus Area | Tests | Pass | Fail | Skipped |
|---|---|:---:|:---:|:---:|:---:|
| `tests/activity.test.js` | Activity tracking, pagination, event filtering, summary stats | 5 | 5 | 0 | 0 |
| `tests/auth.test.js` | User registration, login, rate limiting, JWT generation & verification | 13 | 13 | 0 | 0 |
| `tests/auth.tidb.test.js` | TiDB Cloud live registration & auth flow | 1 | 0 | 0 | 1* |
| `tests/collaboration.hardening.test.js` | Yjs CRDT binary updates, concurrent edits convergence, shutdown flush | 17 | 17 | 0 | 0 |
| `tests/compiler.test.js` | Language catalog, Judge0 payload formatting, supported runtimes | 21 | 21 | 0 | 0 |
| `tests/compiler.integration.test.js` | Guest execution, authenticated execution, token validation, rate limiters | 16 | 16 | 0 | 0 |
| `tests/compiler.external.test.js` | Live external Judge0 endpoint smoke test | 1 | 0 | 0 | 1* |
| `tests/dashboard.test.js` | Aggregated dashboard stats, activity summaries, language breakdown | 6 | 6 | 0 | 0 |
| `tests/health.test.js` | Liveness probe (`/api/health`) | 3 | 3 | 0 | 0 |
| `tests/jwt.test.js` | JWT signing, verification, issuer/audience validation, expiration | 9 | 9 | 0 | 0 |
| `tests/logger.test.js` | Structured JSON logging, log levels, secret masking, HTTP middleware | 11 | 11 | 0 | 0 |
| `tests/phase8.test.js` | Nested folders, folder rename, folder delete, project search, batch save | 10 | 10 | 0 | 0 |
| `tests/phase9.production.test.js` | Readiness probe, Judge0 streaming bounds, shutdown sequence, trust proxy | 58 | 58 | 0 | 0 |
| `tests/project.test.js` | Project CRUD, ownership isolation, file CRUD, path traversal | 11 | 11 | 0 | 0 |
| `tests/rateLimiter.test.js` | Sliding-window algorithm, limit enforcement, cleanup timers | 4 | 4 | 0 | 0 |
| `tests/room.test.js` | Room code generation, creation, join, 404/410, document retrieval | 13 | 13 | 0 | 0 |
| `tests/socket.test.js` | Socket handshake auth, room join, presence, chat ordering & deduplication | 14 | 14 | 0 | 0 |
| `tests/user.test.js` | Profile retrieval, profile update, password change, password reuse | 16 | 16 | 0 | 0 |
| `tests/user.tidb.test.js` | TiDB Cloud live user profile management | 1 | 0 | 0 | 1* |
| `tests/validation.test.js` | Email RFC 5322 regex, password complexity, input sanitization | 6 | 6 | 0 | 0 |
| **Total** | | **227** | **224** | **0** | **3** |

*\*Note: 3 tests (`auth.tidb.test.js`, `compiler.external.test.js`, `user.tidb.test.js`) safely skip when external AWS TiDB Cloud / external Judge0 cluster is unreachable from the local test environment.*

---

## 3. Frontend Test Execution Details

**Runner**: Node.js built-in test runner (`node --test`)  
**Execution Command**: `npm --prefix client test`  
**Duration**: ~130ms  

### Test Suite: `client/tests/frontend.test.js`

1. ✔ Frontend — API configuration strips trailing slashes (0.8ms)
2. ✔ Frontend — Token storage serialization and clearance (0.1ms)
3. ✔ Frontend — Protected route builds correct redirect URL with original destination (0.1ms)
4. ✔ Frontend — Multi-tab state management preserves dirty tracking and revisions (0.1ms)
5. ✔ Frontend — File tree sorts folders first then files alphabetically (7.0ms)
6. ✔ Frontend — Error boundary captures error and formats technical details safely (0.3ms)
7. ✔ Frontend — profile extras are isolated between accounts (0.3ms)
8. ✔ Frontend — new accounts do not inherit another account's profile (0.2ms)
9. ✔ Frontend — profile extras cannot override server-owned identity fields (0.3ms)
10. ✔ Frontend — profile extras validates structures and handles malformed JSON and quota errors (0.9ms)
11. ✔ Frontend — Project creation, duplication and rename validation (0.1ms)
12. ✔ Frontend — Guest compiler execution does not include Authorization header, while auth does (0.1ms)
13. ✔ Frontend — Room code normalization and validation (0.2ms)
14. ✔ Frontend — Debounced autosave timer lifecycle (0.5ms)

**Result**: 14 tests, 14 passed, 0 failed, 0 skipped.

---

## 4. Legacy Server Test Execution Details

**Runner**: Node.js built-in test runner (`node --test`)  
**Execution Command**: `npm --prefix server test`  
**Duration**: ~770ms  

### Test Suites

- `tests/login-hardening.test.js`: Password verification compatibility (legacy bcrypt `$2a$/$2b$`, modern scrypt `salt:hash`, malformed hashes), CORS configuration (apex, custom, and vercel domains). (10 passed)
- `tests/security.test.js`: Static security assertions across `server.js`, `session.js`, `auth.js`, `schema.prisma`, `.env.example` (no hardcoded secrets, no demo auto-creation, rate limiters, session revocation). (31 passed)
- `tests/auth.test.js`: Session service unit tests, environment config unit tests, security assertions, legacy integration skip guard. (8 passed, 1 skipped)

**Result**: 50 tests, 49 passed, 0 failed, 1 skipped.

---

## 5. Build and Static Validation Results

### 5.1 Frontend Production Build
```text
vite v8.3.4 building client environment for production...
transforming...
✓ 3289 modules transformed.
rendering chunks...
dist/index.html                                  1.24 kB │ gzip:   0.59 kB
dist/assets/EditorPage-D4iHitP0.js           1,450.52 kB │ gzip: 372.68 kB
dist/assets/editor.api-BFP9zy7h.js           2,695.65 kB │ gzip: 693.21 kB
✓ built in 2.55s
```
**Status**: 0 build errors.

### 5.2 Frontend Code Quality (Linter)
```text
Found 60 warnings and 0 errors.
Finished in 139ms on 28 files with 104 rules using 10 threads.
```
**Status**: 0 lint errors.

### 5.3 Backend Syntax Verification
```text
node --check across 34 source files in server-v2/src/
```
**Status**: 0 syntax errors.
