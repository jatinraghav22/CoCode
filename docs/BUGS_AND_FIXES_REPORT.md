# CoCode — Bugs and Fixes Report

**Date**: November 25, 2026  
**Auditor**: Senior Software Architect & Security Auditor  
**Repository**: `C:\Users\jatin\CoCode`  

---

## 1. Overview of Audit Findings and Defect Resolutions

During the comprehensive 12-phase audit of the CoCode codebase, every component was checked against security requirements, data isolation boundaries, and error recovery contracts. Safe defects and missing features identified during this audit were remediated and verified through regression testing.

---

## 2. Identified and Fixed Defects

### Bug 1: Missing Project "Rename" Capability in Frontend Projects Dashboard (Phase 10)
- **Severity**: Medium (Functional Incompleteness)
- **Location**: `client/src/pages/Projects.jsx`
- **Root Cause**: The Backend V2 REST API provided a robust `PUT /api/projects/:id` endpoint for renaming and updating projects, but the frontend project card 3-dots dropdown menu only exposed "Duplicate" and "Delete". Users were unable to rename projects directly from the dashboard.
- **Fix Implemented**:
  1. Imported `Edit3` from `lucide-react`.
  2. Implemented `handleRenameProject(proj)` with prompt validation (1–100 characters, trimmed, cancellation guard).
  3. Added the "Rename" action button to the card dropdown menu with disabled state handling during asynchronous operations.
  4. Added automated unit tests in `client/tests/frontend.test.js` validating project rename normalization and bounds checking.
- **Verification**: Verified via `npm --prefix client run build` (compiled cleanly) and `npm --prefix client test` (14/14 tests pass).

---

### Bug 2: Legacy Server Test Port Collision with Running Backend V2 (Phases 5 & 11)
- **Severity**: Low (Test Harness Flaw)
- **Location**: `server/tests/auth.test.js`
- **Root Cause**: When running `npm --prefix server test`, the test suite checked `isServerOnline()` by querying `http://localhost:5000/api/health`. Because `cocode-backend-v2` was running on port 5000, `isServerOnline()` returned `true` thinking it was communicating with the legacy `server.js`. However, `server-v2` was signed with a different JWT secret and connected to TiDB rather than local MySQL, causing token verification to fail with `JsonWebTokenError: invalid signature`.
- **Fix Implemented**:
  1. Updated `isServerOnline()` in `server/tests/auth.test.js` to inspect the response body.
  2. Verified that the service running at port 5000 is indeed the legacy server (checking that `data.service !== "cocode-backend-v2"` and `data.roomsCount !== undefined` and `data.database === "connected"`).
  3. Added `prisma.$queryRaw\`SELECT 1\`` check so that if local MySQL is offline or unreachable, the integration test skips gracefully instead of failing.
- **Verification**: Verified via `npm --prefix server test` (49 passed, 1 skipped, 0 failed).

---

### Bug 3: Missing Automated Frontend Tests for Critical Lifecycle Operations (Phases 7, 8, 10)
- **Severity**: Low (Test Coverage Gap)
- **Location**: `client/tests/frontend.test.js`
- **Root Cause**: The frontend test suite previously had 10 tests, but lacked explicit automated unit test assertions for:
  - Project name validation and duplicate naming logic
  - Guest compiler request header builder (omitting `Authorization` header for guests, attaching Bearer token for authenticated users)
  - Room code format normalization (6-character uppercase alphanumeric regex)
  - Debounced autosave timer scheduling and cancellation on manual save
- **Fix Implemented**:
  Added 4 new comprehensive test suites to `client/tests/frontend.test.js`:
  - `Frontend — Project creation, duplication and rename validation`
  - `Frontend — Guest compiler execution does not include Authorization header, while auth does`
  - `Frontend — Room code normalization and validation`
  - `Frontend — Debounced autosave timer lifecycle`
- **Verification**: Verified via `npm --prefix client test` (14/14 tests pass).

---

## 3. Preserved Architectures and Verified Invariants

1. **Guest Compiler Access**:
   - `createOptionalAuthMiddleware` in `server-v2/src/middleware/auth.js` strictly preserved.
   - `GET /api/compiler/languages` and `POST /api/compiler/run` allow unauthenticated guest execution while preserving authenticated identity when Bearer token is provided.
   - Malformed or expired JWTs sent to compiler routes are strictly rejected with 401.
   - Non-compiler endpoints remain strictly guarded by `requireAuth`.
   - Guest rate limiting (`guest_ip_<ip>`) and authenticated rate limiting (`user_<id>`) verified.
   - User activity tracking for guests is cleanly bypassed.

2. **Database and File Safety**:
   - Zero modifications made to `.bak` files.
   - No destructive database commands (`migrate reset`, `TRUNCATE`) executed against TiDB Cloud.
   - Legacy server files (`server/`) preserved.
   - All 34 backend files in `server-v2` pass `node --check` syntax validation.

---

## 4. Summary Table of Test Coverage Post-Remediation

| Component | Runnable Tests | Passed | Failed | Skipped | Status |
|---|:---:|:---:|:---:|:---:|:---:|
| `server-v2` | 227 | 224 | 0 | 3 | **100% RUNNABLE PASS** |
| `client` | 14 | 14 | 0 | 0 | **100% PASS** |
| `server` | 50 | 49 | 0 | 1 | **100% RUNNABLE PASS** |
| **Combined** | **291** | **287** | **0** | **4** | **100% RUNNABLE PASS** |
