# CoCode – Real-Time Collaborative Cloud Coding Platform

<p align="center">
  <strong>Code Together. Learn Together. Build Together.</strong>
</p>

<p align="center">
  A production-grade, full-stack collaborative cloud IDE and code execution platform engineered for seamless pair programming, instant compilation, and zero-latency real-time collaboration.
</p>

<p align="center">
  <a href="https://getcocode.vercel.app">Live Application</a> •
  <a href="https://github.com/jatinraghav22/CoCode">GitHub Repository</a> •
  <a href="https://cocode-backend-v2.onrender.com/api/health">Backend Health</a> •
  <a href="https://cocode-backend-v2.onrender.com/api/ready">Backend Readiness</a>
</p>

---

## About CoCode

**CoCode** is a modern browser-based developer platform that unites an enterprise-grade Monaco code editor, isolated remote code compilation (Judge0 CE), and conflict-free real-time collaborative editing (Yjs CRDT + Socket.IO) backed by a distributed cloud database (TiDB Cloud Serverless).

Whether you are testing algorithms across 5 programming runtimes, pair programming with colleagues in dedicated rooms, or organizing full-scale coding workspaces, CoCode provides a lightning-fast, distraction-free environment with zero local setup.

---

## Key Features

- **JWT Authentication & Security:** Secure registration, login, and password updates with bcrypt (cost factor 10), stateful token verification, sliding-window rate limiters, and Helmet security headers.
- **Conflict-Free Real-Time Collaboration:** Powered by Yjs CRDTs over Socket.IO. Multiple developers can type simultaneously with deterministic convergence, multi-tab presence tracking, and safe chat delivery.
- **Remote Code Execution:** Isolated code execution via Judge0 CE for 5 programming languages: **Python 3.12, JavaScript (Node 22), C++ (GCC 14), C (GCC 14), and Java (OpenJDK 17)** with strict sandboxing and resource limits.
- **Persistent Cloud Workspace:** Projects, folders, files, and room documents persist reliably in a distributed TiDB Cloud MySQL database with debounced auto-saves and graceful shutdown flushes.
- **Advanced Code Editor:** Integrated Monaco Editor with full syntax highlighting, bracket matching, file tree management, find-and-replace, and dark/light themes.
- **Production Observability:** Liveness (`/api/health`) and database readiness (`/api/ready`) probes, structured sanitized logging, and non-blocking process lifecycle management.

### User Profiles & Data Persistence Architecture

- **Core Account Identity (Backend-Managed):** Critical identity, authentication, and security fields (`id`, `email`, `name`, `passwordHash`, `role`, account creation timestamps) are strictly managed by Backend V2 and securely persisted in the TiDB Cloud MySQL database.
- **Client-Side Profile Extras (Browser Storage):** Non-sensitive customizable profile enhancements (such as `bio`, `phone`, `location`, `skills`, `socialLinks`, `avatarUrl`, and display `username`) managed via `profileStorage.js` are stored on the client side in browser `localStorage` isolated per user ID.
- **Device & Browser Isolation:** Because client-side profile extras reside in local browser storage, they do not automatically synchronize across different browsers, private windows, or devices.

---

## Tech Stack

| Component | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, Monaco Editor, Lucide React, Y-Monaco |
| **Backend V2** | Node.js 20+, Express 5, Socket.IO 4.8, Yjs 13, Prisma 6 ORM, Helmet, Bcryptjs |
| **Database** | TiDB Cloud Serverless (MySQL 8.0 wire-compatible distributed SQL) |
| **Compiler** | Judge0 Community Edition (CE) isolated sandbox |
| **Hosting & CI/CD** | Vercel (Frontend), Render (Backend Web Service), GitHub Actions (CI) |

---

## Project Structure

```text
CoCode/
├── client/                     # Frontend Application (React 19 + Vite 8)
│   ├── src/
│   │   ├── components/         # Shared UI components (Navbar, Footer, ErrorBoundary, IDE widgets)
│   │   ├── pages/              # Code-split views (EditorPage, Compiler, Projects, Dashboard, Rooms)
│   │   ├── config/             # Centralized API configuration (api.js)
│   │   └── AuthContext.jsx     # Global authentication state
│   ├── package.json
│   └── vite.config.js
│
├── server-v2/                  # Production Backend V2 (Node.js 20 + Express 5)
│   ├── src/
│   │   ├── config/             # Environment, Prisma, and Language configurations
│   │   ├── middleware/         # JWT Auth, rateLimiters, error handlers
│   │   ├── modules/            # Domain services (auth, users, compiler, rooms, projects, dashboard)
│   │   ├── routes/             # REST API routers
│   │   ├── sockets/            # Socket.IO connection & event handlers
│   │   ├── utils/              # Structured logger, JWT helpers, input validators
│   │   ├── app.js              # Express app factory
│   │   └── server.js           # Server entry point & graceful shutdown
│   ├── prisma/
│   │   └── schema.prisma       # Database schema (TiDB Cloud MySQL)
│   ├── tests/                  # Automated unit and integration test suite
│   └── package.json
│
├── docs/                       # Comprehensive Production Documentation
│   ├── PRODUCTION_DEPLOYMENT.md
│   ├── ENVIRONMENT_VARIABLES.md
│   ├── SECURITY_AUDIT_REPORT.md
│   ├── MONITORING_GUIDE.md
│   ├── DATABASE_BACKUP_AND_RECOVERY.md
│   ├── API_DOCUMENTATION.md
│   ├── TESTING_GUIDE.md
│   ├── TROUBLESHOOTING_GUIDE.md
│   └── PRODUCTION_RELEASE_CHECKLIST.md
│
├── .github/workflows/          # GitHub Actions CI/CD Pipeline (ci.yml)
├── server/                     # Legacy Backend (Archived & Isolated)
└── README.md
```

---

## Documentation Quick Links

- [Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT.md)
- [Environment Variables Specification](docs/ENVIRONMENT_VARIABLES.md)
- [Security Audit Report](docs/SECURITY_AUDIT_REPORT.md)
- [Database Backup & Disaster Recovery Guide](docs/DATABASE_BACKUP_AND_RECOVERY.md)
- [Monitoring & Logging Guide](docs/MONITORING_GUIDE.md)
- [Complete API Documentation](docs/API_DOCUMENTATION.md)
- [Testing & Validation Guide](docs/TESTING_GUIDE.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING_GUIDE.md)
- [Production Release Checklist](docs/PRODUCTION_RELEASE_CHECKLIST.md)

---

## Local Development Setup

### 1. Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- MySQL-compatible database (Local MySQL or TiDB Cloud Serverless)

### 2. Clone the Repository
```bash
git clone https://github.com/jatinraghav22/CoCode.git
cd CoCode
```

### 3. Frontend Setup (`client`)
```bash
cd client
npm install
npm run dev
# Running on http://localhost:5173
```

### 4. Backend Setup (`server-v2`)
In a separate terminal:
```bash
cd server-v2
npm install
npx prisma generate --schema=prisma/schema.prisma
cp .env.example .env
# Configure DATABASE_URL and JWT_SECRET in .env
npm run dev
# Running on http://localhost:5000
```

---

## Testing & Quality Assurance

Run the automated test suites locally:

```bash
# Run Backend V2 test suite
cd server-v2
npm test
npm run check

# Run Client automated tests, linting, and production build
cd ../client
npm test
npm run lint
npm run build
```

### Verified Test Results (Historical Benchmark)

During the Phase 10 verification cycle, the automated test suites achieved:
- **Total Backend Tests:** 223 tests
- **Passed:** 220 passed
- **Skipped:** 3 skipped (environment-dependent TiDB Cloud integration tests and an optional live Judge0 sandbox verification requiring external network connectivity)
- **Failed:** 0 failed
- **Client Tests:** 10 passed, 0 failed

> [!NOTE]
> Skipped tests depend on live network reachability to external cloud services and are not counted as passed. These metrics reflect a verified historical baseline and are not a hardcoded guarantee of future test results across differing local network environments.
