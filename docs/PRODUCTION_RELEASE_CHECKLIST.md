# CoCode — Production Release Checklist

## Release Verification: Phase 10 Production Hardening

- **Version**: 2.0.0
- **Status**: Production Ready
- **Frontend Target**: `https://getcocode.vercel.app`
- **Backend Target**: `https://cocode-backend-v2.onrender.com`
- **Database Target**: TiDB Cloud Serverless (MySQL 8)

---

### 1. Security & Protection Rules
- [x] Legacy backend directory (`server/`) strictly isolated and unmodified.
- [x] No credentials, secrets, or `.env` files staged or committed to Git.
- [x] TiDB Cloud production database preserved with zero destructive operations.
- [x] No `prisma db push` or `prisma migrate reset` executed against production.
- [x] Strict JWT authentication with strong secret requirement (minimum 32 characters in production).
- [x] All project files, folders, and batch operations protected by ownership authorization (`403 Forbidden`).
- [x] WebSocket connections authenticated and room authorization strictly checked against database.
- [x] Passwords hashed with bcrypt (cost factor 10); password strength enforced (8–72 chars, mixed case, numbers).
- [x] Error handling prevents stack trace and sensitive detail leakage in production API responses.
- [x] Path traversal sequences (`..`) rejected in all file and folder operations.
- [x] In-memory rate limiting active on auth, room creation, password changes, and compiler routes.
- [x] Non-sensitive profile extras (`username`, `phone`, `location`, `bio`, `skills`, `socialLinks`, `avatarUrl`) stored in user-isolated browser `localStorage` without overriding server-owned properties. Core identity fields (`id`, `name`, `email`, `role`, `passwordHash`) remain strictly cloud-persisted and backend-managed.

### 2. Supply Chain & Dependencies
- [x] Client dependencies audited: `0 vulnerabilities` reported by `npm audit`.
- [x] Client `dompurify` override configured to `^3.5.0` to eliminate Monaco sub-dependency vulnerabilities.
- [x] Backend V2 stable dependencies preserved with Node.js 20+ runtime compatibility.
- [x] Transitive Prisma CLI dev dependencies documented in security report.

### 3. Reliability & Real-Time Collaboration
- [x] Debounced document persistence to TiDB Cloud with conflict-free version tracking.
- [x] Graceful shutdown sequence: Socket.IO close -> Room flush -> Prisma disconnect.
- [x] Shutdown deadline protection (20,000 ms) preventing stalled process termination.
- [x] Shared loading promise in `roomStateStore` resolving concurrent room join race conditions.
- [x] Yjs CRDT binary state synchronization ensuring convergence across multiple concurrent editors.
- [x] Multi-tab socket presence tracking (user stays online as long as at least one tab remains open).
- [x] Structured production logging utility implemented with automatic credential redaction.

### 4. Compiler Integration
- [x] Verified 5 execution runtimes: C, C++, Java, JavaScript, Python.
- [x] Payload size limits enforced (source code max 30,000 chars, stdin max 10,000 chars).
- [x] Upstream failure mapping (`502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`).
- [x] Isolated execution sandbox (network disabled, 2s CPU limit, 5s wall-clock limit, 128 MB RAM).

### 5. Automated Tests & CI/CD
- [x] Backend V2 test suite: **220 passed, 0 failed, 3 skipped (223 total tests)**.
- [x] Client test suite: **10 passed, 0 failed**.
- [x] Client linter (`oxlint`): **0 errors**.
- [x] Client production build: succeeds with code-split vendor chunks.
- [x] Backend module syntax check (`npm run check` across 35 files): passes cleanly.
- [x] GitHub Actions workflow `.github/workflows/ci.yml` passes end-to-end.

### 6. Live Production Verification
- [x] Health probe (`/api/health`): `HTTP 200` healthy.
- [x] Readiness probe (`/api/ready`): `HTTP 200` database healthy.
- [x] Frontend URL (`https://getcocode.vercel.app`): `HTTP 200` operational.
