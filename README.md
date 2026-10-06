# 💻 CoCode - Code Together

**[🌐 Live Demo](https://cocode-dyd7.onrender.com)**

---

## 🚀 Overview

**CoCode** is a real-time collaborative code editor that allows multiple users to **write ✍️, edit 🧠, draw 🎨, and chat 💬 simultaneously** in the same workspace. It brings the experience of **pair programming, remote interviews, and group collaboration** right into your browser — no setup needed! 🌐

Whether you're conducting technical interviews, pair programming with teammates, or collaborating on coding projects, **CoCode** provides a seamless, feature-rich environment for real-time code collaboration.

---

## ✨ Features

### Core Editing

- ⚡ **Real-time Collaborative Code Editing** with live cursor position sync
- 🖊️ **Syntax Highlighting** with Monaco Editor (50+ languages supported)
- 📝 **Multiple File Editor** with tabs and file management
- 🎨 **Collaborative Drawing Board** for sketching and diagrams
- 📁 **Complete File System** - Create, rename, delete files and folders

### Collaboration & Communication

- 💬 **Built-in Chat System** with real-time messaging
- 👥 **Live User Presence** showing who's online, typing, and editing
- 🔔 **Real-time Activity Timeline** tracking all room events
- 📌 **Pinned Room Notes** for sharing important information
- 🏷️ **Join by Room ID** - Easy sharing and access

### Code Execution & Management

- ▶️ **Code Execution** - Run code in 50+ languages via Judge0 API
- 📜 **Run History** - Store and re-run previous executions
- 📚 **Version History** - Track file changes with snapshot snapshots and restore
- 🕐 **Execution History** - Keep logs of all code runs
- ⚙️ **Automatic Language Detection** based on file extensions

### Customization & UX

- 🎚️ **Theme Switching** - Light and dark mode support
- 🌍 **Language Switching** - Multiple UI language support
- 📱 **Fully Responsive Design** - Works on desktop, tablet, and mobile
- ⚡ **Optimized Performance** - Fast load times and smooth interactions
- 🔍 **Advanced Search** - Search files and content with highlighting

### Infrastructure

- 🔗 **Real-time WebSocket Communication** via Socket.IO
- 🛠️ **Modern Tech Stack** - React, TypeScript, Tailwind CSS
- 📦 **Production Ready** - Deployable to Vercel and Render
- 🔐 **Room-based Access Control** - Private collaboration spaces

---

## 🛠️ Tech Stack

### Frontend

- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Monaco Editor** - Advanced code editor
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP client for API calls

### Backend

- **Node.js** - Runtime environment
- **Express** - Web framework (via Socket.IO)
- **Socket.IO** - WebSocket communication
- **TypeScript** - Type-safe backend code

### External APIs

- **Judge0 API** - Code execution for 50+ languages
- **Piston API** - Alternative code execution engine
- **Pollinations API** - Image generation (optional)

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** (v8 or higher) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)

Verify installation:

```bash
node --version  # Should be v16+
npm --version   # Should be v8+
git --version
```

---

## 📦 Installation & Setup

### Option 1: Quick Start from Root (Recommended)

From the project root:

```bash
# 1. Install root dependencies (for running both servers concurrently)
npm install

# 2. Install all frontend and backend dependencies
npm run install:all

# 3. Start both backend and frontend development servers together
npm run dev
```

* **Frontend:** `http://localhost:5173`
* **Backend:** `http://localhost:5000`

---

### Option 2: Running Frontend & Backend Separately

> **Important:** Both the backend and frontend servers must be running during development.

#### 1. Backend Server

Open your first terminal:

```bash
cd backend
npm install
npm run dev
```

The backend server will start on `http://localhost:5000`.

#### 2. Frontend Application

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend application will start on `http://localhost:5173`.

---

## ⚙️ Environment Variables

### Backend Environment Configuration (`backend/.env`)

Create a `.env` file in the `backend/` directory (see [backend/.env.example](file:///c:/Users/jatin/Projects/CoCodee/backend/.env.example)):

```env
PORT=5000
JWT_SECRET=cocodee_jwt_secret_super_secure_key_change_in_production
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Optional Code Execution APIs
JUDGE0_API_KEY=your_judge0_api_key_here
PISTON_API_URL=https://emkc.org/api/v2
```

### Frontend Environment Configuration (`frontend/.env.local`)

Create a `.env.local` file in the `frontend/` directory (see [frontend/.env.example](file:///c:/Users/jatin/Projects/CoCodee/frontend/.env.example)):

```env
# Centralized API & Socket URLs
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
VITE_BACKEND_URL=http://localhost:5000

# Optional Feature Flags & APIs
VITE_JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
VITE_JUDGE0_API_KEY=your_judge0_api_key_here
VITE_PISTON_API_URL=https://emkc.org/api/v2
VITE_POLLINATIONS_API_URL=https://image.pollinations.ai
VITE_ENABLE_DRAWING=true
VITE_ENABLE_CHAT=true
VITE_ENABLE_CODE_EXECUTION=true
```

> **Note for Production:** Replace `http://localhost:5000` with your deployed backend URL.

---

## 📁 Project Architecture

```text
CoCodee/
│
├── frontend/                       # React 18 + TypeScript + Vite SPA
│   ├── public/                     # Static assets (icons, images)
│   ├── src/
│   │   ├── api/                    # HTTP & Auth API services
│   │   ├── components/             # UI Components (Editor, Canvas, Navbar, Forms)
│   │   │   ├── auth/               # Protected route guard
│   │   │   ├── common/             # Navbar, Footer, Modal, Select
│   │   │   ├── editor/             # Code editor components
│   │   │   ├── drawing/            # Tldraw collaborative whiteboard
│   │   │   ├── chats/              # Room chat components
│   │   │   ├── sidebar/            # Sidebar views & user profile controls
│   │   │   └── workspace/          # Collaborative workspace
│   │   ├── config/                 # Centralized environment config (API & Socket URLs)
│   │   ├── context/                # React Contexts (Auth, Socket, File, Chat, etc.)
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── pages/                  # Route Pages (Home, Login, Register, Dashboard, etc.)
│   │   ├── styles/                 # Global styles and theme tokens
│   │   ├── types/                  # TypeScript interface definitions
│   │   ├── App.tsx                 # Root router & route definitions
│   │   └── main.tsx                # App entry point
│   ├── package.json                # Frontend dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── vite.config.mts             # Vite bundler config
│   └── tailwind.config.ts          # Tailwind CSS styling config
│
├── backend/                        # Node.js + Express + TypeScript + Socket.IO
│   ├── src/
│   │   ├── db/                     # Data stores (UserStore with JSON persistence)
│   │   ├── middleware/             # JWT auth middleware
│   │   ├── routes/                 # API Routes (/api/auth)
│   │   ├── types/                  # Backend type definitions
│   │   └── server.ts               # Express server & Socket.IO event handler
│   ├── data/                       # Local persistent data directory
│   ├── package.json                # Backend dependencies
│   ├── tsconfig.json               # TypeScript config
│   └── .env.example                # Backend environment template
│
├── .gitignore                      # Monorepo-level git ignore rules
├── package.json                    # Root scripts for running/building both apps
└── README.md                       # Main project documentation
```

---

## 🚀 Building for Production

### Build Both with Root Script

```bash
npm run build
```

This compiles both `backend/` (`tsc`) and `frontend/` (`vite build`).

### Build Individually

```bash
# Build Frontend
cd frontend
npm run build

# Build Backend
cd backend
npm run build
```

#### Run Production Build

```bash
# Backend
cd server
npm start

# Frontend
cd client
npm run preview
```

---

## 🏗️ Architecture Overview

### Real-time Communication Flow

```
User A (Client)
    ↓ (Socket.IO Event)
    ↓ (Emit: FILE_UPDATE, CODE_EXECUTED, USER_TYPING, etc.)
Server (Node.js + Socket.IO)
    ↓ (Broadcast to room)
    ↓ (Emit: FILE_UPDATED, ACTIVITY, etc.)
User B, C, ... (Clients)
    ↓ (Update local state via Context)
    ↓ (React re-renders with new data)
UI Updates in Real-time
```

### Component Hierarchy

```
App (AppProvider wrapper)
├── EditorPage / HomePage
│   ├── Sidebar
│   │   └── SidebarView (multiple views: Editor, Chat, History, Activity, etc.)
│   ├── Editor (Monaco Editor with Tabs)
│   ├── DrawingEditor
│   ├── ChatComponent
│   └── ...
```

### State Management

Each feature has its own Context:

- **FileContext** - File tree, open files, version history
- **ChatContext** - Messages, pinned notes
- **RunCodeContext** - Code execution history
- **AppContext** - Global app state, room activity
- **SocketContext** - WebSocket connection state
- **ViewContext** - Current active view

---

## 🔌 Socket.IO Events

### Client → Server (Emit)

| Event              | Payload                        | Purpose             |
| ------------------ | ------------------------------ | ------------------- |
| `FILE_CREATE`    | `{path, content}`            | Create new file     |
| `FILE_UPDATE`    | `{fileId, content}`          | Update file content |
| `FILE_RENAME`    | `{fileId, newName, oldName}` | Rename file         |
| `FILE_DELETE`    | `{fileId}`                   | Delete file         |
| `CODE_EXECUTION` | `{code, language}`           | Execute code        |
| `CHAT_MESSAGE`   | `{text, userId}`             | Send chat message   |
| `USER_TYPING`    | `{typing: boolean}`          | Typing indicator    |

### Server → Client (Broadcast)

| Event               | Payload               | Purpose                 |
| ------------------- | --------------------- | ----------------------- |
| `FILE_UPDATED`    | `{fileId, content}` | New file change         |
| `CODE_EXECUTED`   | `{output, result}`  | Code execution result   |
| `ROOM_ACTIVITY`   | `{activity[]}`      | Activity timeline entry |
| `PINNED_NOTE_SET` | `{text}`            | Pinned note updated     |
| `USER_ACTIVITY`   | `{userId, status}`  | User status change      |

---

## 🌐 Deployment

### Frontend Deployment (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard:
   ```
   VITE_BACKEND_URL=your_backend_url
   VITE_JUDGE0_API_KEY=your_key
   ```
4. Deploy with `npm run build`

### Backend Deployment (Render)

1. Push code to GitHub
2. Create new Web Service on Render
3. Set Build & Start commands:
   ```
   Build: npm install && npm run build
   Start: npm start
   ```
4. Set environment variables in Render dashboard
5. Deploy

**Update Frontend:** After deploying backend, update `VITE_BACKEND_URL` in frontend to point to your Render URL.

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**

   ```bash
   git clone https://github.com/yourusername/CoCode.git
   ```
2. **Create a feature branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** and commit

   ```bash
   git commit -m "Add amazing feature"
   ```
4. **Push to your fork**

   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request** with a clear description

### Development Guidelines

- Write clean, readable code with comments
- Follow existing code style and patterns
- Test changes locally before submitting PR
- Update documentation if adding new features
- Use TypeScript for all new code

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

✨ **Give this project a ⭐ if you found it helpful!** ✨

Made with 💛 for developers, by developers.

</div>
