# 💻 CoCode - Real-Time Collaborative Coding Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb.svg)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/RealTime-Socket.IO-black.svg)](https://socket.io/)
[![Deployment](https://img.shields.io/badge/Deploy-Vercel%20%7C%20Render-black.svg)](https://render.com)

**GitHub Repository:** [https://github.com/jatinraghav22/CoCode](https://github.com/jatinraghav22/CoCode)  
**Live Frontend:** `https://your-cocode-frontend.vercel.app` *(Placeholder — update after deployment)*  
**Live Backend:** `https://your-cocode-backend.onrender.com` *(Placeholder — update after deployment)*  

---

## 🚀 Overview

**CoCode** is a production-ready real-time collaborative development environment. It empowers teams, students, and interviewers to write, edit, execute code, whiteboard diagrams, and chat synchronously in shared virtual rooms without any local setup.

Whether pair-programming across continents, conducting technical interviews, or brainstorming on an infinite whiteboard canvas, **CoCode** provides a fluid, responsive, low-latency experience.

---

## ✨ Features

### 🖥️ Code Editing & Workspace
- **Multi-File Workspace:** Create, rename, edit, and organize files and nested directories in a full file explorer.
- **CodeMirror 6 Core:** Ultra-fast code editor equipped with syntax highlighting, line numbers, bracket matching, and theme customization.
- **Auto Language Detection:** Detects programming languages based on file extensions.
- **Local Persistence & Export:** Download individual files or export your entire workspace as a ZIP file.

### 👥 Real-Time Collaboration
- **Live Collaborative Editing:** Synchronize code changes with room participants in real-time.
- **Cursor & Presence Sync:** Track active collaborators, online/offline status, and typing indicators.
- **Activity Timeline:** Track room events (file creation, edits, runs, user joins/leaves) in real-time.
- **Pinned Room Notes:** Share persistent room scratchpads and announcements.

### 🎨 Infinite Drawing Board
- **Integrated Tldraw Whiteboard:** Brainstorm architectures, sketch system designs, and collaborate visually alongside your code editor.
- **Room Canvas Synchronization:** Whiteboard drawings sync across connected room members.

### 💬 Built-in Room Chat
- **Real-Time Chat:** Message collaborators directly inside your room.
- **Message Badges & Unread Counters:** Stay alerted without interrupting your typing flow.

### ▶️ Multi-Language Code Execution
- **Multi-Tier Execution Engine:** Dual compiler support utilizing backend proxies and direct fallbacks to **Judge0** and **Piston API** (supports C++, C, Python, JavaScript, TypeScript, Java, Rust, Go, C#, PHP).
- **Interactive Stdin / Execution Output:** Run code with custom inputs and view stdout, stderr, compile errors, and runtime stats.

### 🔐 Authentication & Session Security
- **JWT Authentication:** Secure user registration, login, profile updates, and token verification.
- **Password Protection:** Encrypted passwords via bcrypt hashing.
- **Client Session Management:** Persistent login sessions with remember-me capability.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, Vite 6 |
| **Frontend Styling** | TailwindCSS, PostCSS, Framer Motion |
| **Code Editor** | CodeMirror 6 (`@uiw/react-codemirror`), Themes & Extensions |
| **Drawing Board** | Tldraw 2.1 |
| **Real-time Client** | Socket.IO Client 4.7 |
| **HTTP Client** | Axios |
| **Backend Runtime** | Node.js (ES Modules, Node 18+) |
| **Backend Server** | Express 4.21 |
| **Real-time Server** | Socket.IO 4.7 |
| **Security & Auth** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `cors`, `dotenv` |
| **Data Storage** | Built-in JSON Store with atomic persistence (`backend/data/users.json`) |
| **Execution Engines** | Judge0 API, Piston API |

---

## 📁 Repository Structure

```text
CoCode/
├── frontend/                  # React 18 + Vite frontend
│   ├── public/                # Static assets, favicon, etc.
│   ├── src/
│   │   ├── api/               # Auth & code execution API clients
│   │   ├── components/        # Editor, whiteboard, chat, modals, file tree
│   │   ├── config/            # Centralized environment configuration (env.js)
│   │   ├── context/           # Socket, Auth, File, App, Chat state contexts
│   │   ├── hooks/             # Custom responsive & context menu hooks
│   │   ├── pages/             # Home, Editor, Login, Register, Profile pages
│   │   ├── types/             # Socket and user constants
│   │   ├── App.jsx            # Application router
│   │   └── main.jsx           # React DOM root entry
│   ├── .env.example           # Frontend environment variable template
│   ├── index.html             # HTML entry template
│   ├── package.json           # Frontend dependencies and scripts
│   ├── vercel.json            # Vercel SPA routing rewrite rules
│   └── vite.config.js         # Vite configuration with chunk splitting
│
├── backend/                   # Node.js + Express + Socket.IO backend
│   ├── data/                  # Runtime user data store (git-ignored)
│   ├── public/                # Landing index.html page
│   ├── src/
│   │   ├── db/                # User storage provider (userStore.js)
│   │   ├── middleware/        # JWT authentication middleware
│   │   ├── routes/            # Auth & compiler execution routes
│   │   ├── types/             # Socket event and user status definitions
│   │   └── server.js          # Express server, Socket.IO handlers, /health check
│   ├── .env.example           # Backend environment variable template
│   ├── .gitignore             # Backend gitignore rules
│   └── package.json           # Backend dependencies and scripts
│
├── .env.example               # Unified monorepo environment template
├── .gitignore                 # Root gitignore rules
├── package.json               # Root scripts for running/building both workspaces
├── render.yaml                # Render Blueprint deployment specification
├── vercel.json                # Root Vercel configuration for SPA builds
└── README.md                  # Comprehensive documentation
```

---

## ⚙️ Environment Variables

### Root / Unified Reference (`.env.example`)

Copy the template to your environment or configure these keys in your deployment platform:

```env
# Backend Configuration
NODE_ENV=production
PORT=10000
JWT_SECRET=your_super_secret_jwt_key_here
FRONTEND_URL=https://your-frontend.vercel.app
CLIENT_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173

# Optional: External Database URL
DATABASE_URL=

# Frontend Configuration (Vite)
VITE_API_URL=https://your-backend.onrender.com
VITE_SOCKET_URL=https://your-backend.onrender.com
VITE_BACKEND_URL=https://your-backend.onrender.com
```

### Backend Variables (`backend/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `5000` | Port to bind. Cloud platforms (Render, Railway) automatically inject `$PORT`. |
| `NODE_ENV` | No | `development` | Runtime mode (`development` or `production`). |
| `JWT_SECRET` | **Yes (Prod)** | Default fallback | Cryptographic secret for signing and verifying JWT tokens. |
| `FRONTEND_URL` | **Yes (Prod)** | `http://localhost:5173` | Allowed production frontend origin for CORS and WebSocket handshake. |
| `CLIENT_URL` | No | `http://localhost:5173` | Alias for `FRONTEND_URL`. |
| `CORS_ORIGINS` | No | — | Comma-separated list of allowed origins. |
| `DATABASE_URL` | No | — | Optional connection string for external databases. |
| `JUDGE0_URL` | No | `https://ce.judge0.com` | Custom or self-hosted Judge0 instance URL. |
| `JUDGE0_API_KEY` | No | — | RapidAPI key if using paid Judge0 tier. |

### Frontend Variables (`frontend/.env.local` or Vercel Environment Variables)

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `VITE_API_URL` | **Yes (Prod)** | `http://localhost:5000` (in dev) | Deployed backend REST API base URL. |
| `VITE_SOCKET_URL` | No | `VITE_API_URL` | Deployed backend Socket.IO base URL. |
| `VITE_BACKEND_URL` | No | `VITE_API_URL` | Alias fallback for `VITE_API_URL`. |
| `VITE_PISTON_URL` | No | `https://emkc.org/api/v2/piston` | Direct Piston API fallback URL. |

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **Git**

Verify your environment:
```bash
node -v
npm -v
```

### 2. Clone Repository
```bash
git clone https://github.com/jatinraghav22/CoCode.git
cd CoCode
```

### 3. Install Dependencies
Install all root, backend, and frontend dependencies in one command:
```bash
npm run install:all
```

### 4. Configure Local Environment
Set up backend environment:
```bash
cp backend/.env.example backend/.env
```

Set up frontend environment:
```bash
cp frontend/.env.example frontend/.env.local
```

### 5. Start Development Servers
Run both backend and frontend concurrently:
```bash
npm run dev
```

- **Frontend App:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **Health Check:** [http://localhost:5000/health](http://localhost:5000/health)

---

## 🚢 Production Deployment

The architecture separates the application into a decoupled **Frontend SPA** (optimized for global edge CDNs like Vercel) and a **Backend Web Service** with WebSocket persistence (optimized for platforms like Render).

```text
                  ┌──────────────────────────────────────────────┐
                  │             User Web Browser                 │
                  └──────────────┬───────────────────────────────┘
                                 │
                   HTTPS Requests│WebSocket Connections
                                 ▼
         ┌───────────────────────────────┐     ┌───────────────────────────────┐
         │       Frontend (Vercel)       │     │       Backend (Render)        │
         │  - Static React 18 SPA        │     │  - Express REST API           │
         │  - Vite Bundle via Global CDN │────▶│  - Socket.IO WebSockets       │
         │  - SPA Routing (/rewrites)    │     │  - JWT Auth + User Store      │
         │                               │     │  - Health Check: GET /health  │
         └───────────────────────────────┘     └───────────────┬───────────────┘
                                                               │
                                                               ▼
                                               ┌───────────────────────────────┐
                                               │   Judge0 / Piston Compilers   │
                                               │   (External Code Runners)     │
                                               └───────────────────────────────┘
```

---

### Step A: Deploy Backend to Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** ➔ **Web Service**.
3. Connect your GitHub repository: `https://github.com/jatinraghav22/CoCode`.
4. Configure the Web Service settings:
   - **Name:** `cocode-backend` (or your preferred name)
   - **Region:** Choose the region nearest to you (e.g., Oregon, Frankfurt, Singapore)
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Click **Advanced** and set the **Health Check Path**:
   - `/health`
6. Under **Environment Variables**, add:
   ```text
   NODE_ENV = production
   PORT = 10000
   JWT_SECRET = <Generate a strong random 32+ character string>
   FRONTEND_URL = https://your-cocode-frontend.vercel.app
   CORS_ORIGINS = https://your-cocode-frontend.vercel.app
   ```
   *(Note: You can fill in the temporary placeholder or update `FRONTEND_URL` once your Vercel URL is created).*
7. Click **Create Web Service**.
8. Once deployed, copy your backend URL (e.g. `https://cocode-backend.onrender.com`).
9. Verify the backend health:
   ```bash
   curl https://your-cocode-backend.onrender.com/health
   # Expected output: {"status":"ok","uptime":...}
   ```

> **Automated Render Blueprint:** Alternatively, Render will detect the included `render.yaml` file at the root of the repository, enabling 1-click Blueprints deployment.

---

### Step B: Deploy Frontend to Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** ➔ **Project**.
3. Import the repository: `jatinraghav22/CoCode`.
4. Configure the Project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click `Edit` and select `frontend` (or leave as root; the included root `vercel.json` supports both).
   - **Build Command:** `npm run build` (or `vite build`)
   - **Output Directory:** `dist`
5. Under **Environment Variables**, configure:
   ```text
   VITE_API_URL = https://your-cocode-backend.onrender.com
   VITE_SOCKET_URL = https://your-cocode-backend.onrender.com
   ```
   *(Ensure there is no trailing slash in the URL).*
6. Click **Deploy**.
7. Once deployment finishes, copy your live frontend domain (e.g. `https://cocode-frontend.vercel.app`).
8. Return to your Render backend dashboard and ensure `FRONTEND_URL` and `CORS_ORIGINS` match your live Vercel domain.

---

## 🗄️ Database & Storage Architecture

### Default Store (Out-of-the-Box)
- The application includes an autonomous file-backed JSON user store located at `backend/data/users.json`.
- It initializes automatically upon first launch and provides persistent user registration and password hashing.
- `backend/data/*.json` is excluded from git version control via `.gitignore` to safeguard user privacy.

### Migrating to an External Database (MongoDB / PostgreSQL)
If scaling to multiple server replicas or stateless serverless containers:
1. Provide a `DATABASE_URL` in `backend/.env`.
2. Connect your preferred ORM (e.g., Mongoose, Prisma, or TypeORM) inside `backend/src/db/`.
3. The existing query methods in `backend/src/db/userStore.js` (`createUser`, `findUserByEmail`, `findUserById`, `updateUser`) can be cleanly replaced without touching routes or UI components.

---

## 🔌 Socket.IO Production Configuration

CoCode relies on low-latency bidirectional WebSocket communication:

- **Transports:** Supports both native `websocket` and HTTP `polling` fallback for maximum firewall and proxy compatibility.
- **Connection Handshake:** Automatic origin verification against `FRONTEND_URL` and `CORS_ORIGINS`.
- **Reconnection Engine:** Configured with exponential backoff (`reconnectionAttempts: 10`, `reconnectionDelay: 1000ms`, `reconnectionDelayMax: 5000ms`) to gracefully handle server restarts or cold boots on free tiers.
- **Buffer Capacity:** `maxHttpBufferSize: 1e8` (100MB) to seamlessly handle real-time sync of large source code files and Tldraw canvas snapshots.

---

## 🧪 Build & Verification Commands

### Test Frontend Production Build Locally
```bash
npm run build:frontend
```

### Test Backend Startup Locally
```bash
npm run build:backend
npm run start
```

### Verify Endpoints
```bash
# Health Check
curl http://localhost:5000/health

# Available Compilers
curl http://localhost:5000/api/languages
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
