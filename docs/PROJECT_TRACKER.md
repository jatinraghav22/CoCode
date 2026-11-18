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
| 2 | TiDB and Prisma connection | Pending |
| 3 | Authentication and user model | Pending |
| 4 | Profile and account APIs | Pending |
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
