# CoCode — Unified Real-Time Collaborative Coding Platform

A cloud-based real-time collaborative code editor and multi-language development environment built with React, Node.js, Socket.IO, Monaco Editor, MySQL, and Prisma ORM.

---

## 🛠️ Tech Stack

- **Frontend:** React.js 19 + Vite + Vanilla CSS Design System
- **Backend:** Node.js + Express.js
- **Real-Time Collaboration:** Socket.IO
- **Code Editor:** Monaco Editor (VS Code core engine)
- **Database & ORM:** MySQL Community Server 8.0 + Prisma ORM
- **Authentication:** JWT (JSON Web Tokens) + bcryptjs password hashing
- **Code Execution:** Isolated Sandbox Engine (Judge0 CE)
- **Routing:** React Router v7
- **HTTP Client:** Axios with JWT request interceptors
- **Icons:** Lucide React

---

## 🚀 Quick Start Guide

### 1. Database Setup (MySQL)
Make sure your MySQL 8.0 service is running:
1. Open your MySQL client (or MySQL Workbench) and create a database:
   ```sql
   CREATE DATABASE cocode;
   ```
2. Open `server/.env` and update your MySQL password:
   ```env
   DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/cocode"
   ```
3. Push the Prisma schema to create all tables:
   ```powershell
   cd C:\Users\jatin\CoCode\server
   npx prisma db push
   ```

---

### 2. Running the Backend Server
From directory `C:\Users\jatin\CoCode\server`:
```powershell
npm run dev
```
The server will start at: `http://localhost:5000` with active Socket.IO gateway.

---

### 3. Running the Frontend Client
From directory `C:\Users\jatin\CoCode\client`:
```powershell
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 🌟 Key Features

1. **Standalone & Project Compiler:**
   - Launch the compiler directly without room creation.
   - Syntax highlighting, code formatting, and execution for 50+ programming languages.
   - Live stdout, stderr, compile diagnostics, execution time, and memory usage metrics.
   - Standard input (`stdin`) console for interactive CLI programs.

2. **Real-Time Collaborative Coding:**
   - Instant room creation with shareable room codes (e.g. `CO-XXXX`).
   - Bidirectional Monaco Editor synchronization with conflict loop avoidance.
   - Active participant presence tracking with live avatars.

3. **In-Room Discussion & Shared Whiteboard:**
   - Room-based chat with timestamped message history.
   - Shared drawing board supporting multi-color drawing, brush thickness, eraser, and clear canvas.

4. **Multi-File Workspace:**
   - Create, open, rename, and delete nested files and folders.
   - Stored persistently in MySQL.

5. **Version Snapshots & Rollback:**
   - Milestone snapshots with descriptive labels.
   - One-click rollback to any previous version.

---

## 🚢 Deployment Configuration

### Frontend (Vercel)
- **Framework Preset:** Vite
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_API_URL`: `https://your-backend.onrender.com/api`
  - `VITE_SOCKET_URL`: `https://your-backend.onrender.com`

### Backend (Render)
- **Environment:** Node
- **Root Directory:** `server`
- **Build Command:** `npm install && npx prisma generate`
- **Start Command:** `node src/server.js`
- **Environment Variables:**
  - `PORT`: `5000`
  - `CLIENT_URL`: `https://your-frontend.vercel.app`
  - `DATABASE_URL`: Hosted MySQL connection string (e.g., Aiven, PlanetScale, or Railway)
  - `JWT_SECRET`: Secure random string
  - `JUDGE0_URL`: `https://ce.judge0.com`
