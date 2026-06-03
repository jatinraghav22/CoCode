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

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/aurindumgit/CoCode.git
cd CoCode
```

### 2. Install Dependencies

#### Backend Setup

```bash
cd server
npm install
```

#### Frontend Setup

```bash
cd ../client
npm install
```

---

## ⚙️ Environment Variables Setup

### Backend Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Socket.IO Configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Code Execution APIs
JUDGE0_API_KEY=your_judge0_api_key_here
PISTON_API_URL=https://emkc.org/api/v2

# Database (if using MongoDB, etc.)
# MONGODB_URI=your_mongodb_uri_here

# CORS Settings
CORS_ALLOW_CREDENTIALS=true
```

**API Keys to Obtain:**

- **Judge0 API Key** - Sign up at [judge0.com](https://judge0.com)
- **Piston API** - Free public API, no key needed
- **Pollinations API** - Optional, for image generation

### Frontend Environment Variables

Create a `.env.local` file in the `client/` directory:

```env
# API Configuration
VITE_BACKEND_URL=http://localhost:5000
VITE_JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
VITE_JUDGE0_API_KEY=your_judge0_api_key_here
VITE_PISTON_API_URL=https://emkc.org/api/v2
VITE_POLLINATIONS_API_URL=https://image.pollinations.ai

# Feature Flags
VITE_ENABLE_DRAWING=true
VITE_ENABLE_CHAT=true
VITE_ENABLE_CODE_EXECUTION=true
```

**Note:** For production, replace `localhost:5000` with your deployed backend URL.

---

## 📁 Project Structure

```
CoCode/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── editor/            # Code editor component
│   │   │   ├── drawing/           # Drawing board
│   │   │   ├── chats/             # Chat UI
│   │   │   ├── sidebar/           # Sidebar with views
│   │   │   │   └── sidebar-views/ # Individual sidebar components
│   │   │   ├── files/             # File management UI
│   │   │   ├── common/            # Reusable components
│   │   │   └── connection/        # Connection status
│   │   ├── context/               # React context for state
│   │   │   ├── AppContext.tsx     # Global app state
│   │   │   ├── FileContext.tsx    # File system state
│   │   │   ├── ChatContext.tsx    # Chat state
│   │   │   ├── RunCodeContext.tsx # Code execution state
│   │   │   ├── SocketContext.tsx  # WebSocket state
│   │   │   └── ViewContext.tsx    # View/route state
│   │   ├── api/                   # API client modules
│   │   │   ├── judge0Api.ts       # Judge0 integration
│   │   │   ├── pistonApi.ts       # Piston API integration
│   │   │   └── pollinationsApi.ts # Image generation API
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── pages/                 # Page components
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── utils/                 # Utility functions
│   │   ├── resources/             # Static resources
│   │   ├── styles/                # Global CSS
│   │   ├── App.tsx                # Root component
│   │   └── main.tsx               # Entry point
│   ├── public/                    # Static files
│   ├── package.json              # Frontend dependencies
│   ├── tsconfig.json             # TypeScript config
│   ├── vite.config.mts           # Vite config
│   ├── tailwind.config.ts        # Tailwind CSS config
│   └── vercel.json               # Vercel deployment config
│
├── server/                        # Backend application
│   ├── src/
│   │   ├── server.ts             # Main server file
│   │   └── types/                # TypeScript interfaces
│   ├── public/                   # Static files
│   ├── package.json              # Server dependencies
│   ├── tsconfig.json             # TypeScript config
│   └── README.md                 # Server documentation
│
├── README.md                      # This file
└── .gitignore                    # Git ignore rules
```

---

## 🚀 Running the Project

### Development Mode

#### Start the Backend Server

```bash
cd server
npm run dev
```

Server will run on `http://localhost:5000`

#### Start the Frontend Development Server (in another terminal)

```bash
cd client
npm run dev
```

Frontend will run on `http://localhost:5173`

Open your browser and navigate to `http://localhost:5173`

### Production Mode

#### Build the Client

```bash
cd client
npm run build
```

This creates an optimized production build in `client/dist/`

#### Build the Server (if needed)

```bash
cd server
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
