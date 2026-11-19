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
| 5 | User-specific dashboard APIs | Pending |
| 6 | Projects and file management | Pending |
| 7 | Judge0 compiler integration | Pending |
| 8 | Socket.IO collaboration | Pending |
| 9 | Security and validation | Pending |
| 10 | Frontend integration | Pending |
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
