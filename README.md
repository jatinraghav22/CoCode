# 🚀 CoCode — Unified Real-Time Collaborative Coding Platform

<p align="center">
  <b>Code Together. Collaborate in Real Time. Build Faster.</b>
</p>

<p align="center">
  A modern unified real-time collaborative coding platform that brings coding, execution, communication, drawing, and collaboration together in one workspace.
</p>

---

## 🌐 Live Project

### 🚀 Live Demo

https://co-code-ten.vercel.app/

### ⚙️ Backend API

https://cocode-backend-6lvi.onrender.com

### 💻 GitHub Repository

https://github.com/jatinraghav22/CoCode

### 👨‍💻 Developer Portfolio

https://jatinraghav.vercel.app/

---

# 📌 About CoCode

**CoCode** is a **Unified Real-Time Collaborative Coding Platform** designed for developers, students, teams, and coding learners.

It provides a unified workspace where users can write, execute, discuss, visualize, and manage code together in real time.

Instead of using separate tools for coding, communication, execution, and visual collaboration, CoCode brings these capabilities together into one platform.

### CoCode provides:

* 👥 Real-time collaborative coding
* 💻 Personal code compiler
* 📁 Multi-file workspace
* ▶️ Code execution
* 💬 Real-time chat
* 🎨 Collaborative drawing board
* 👀 User presence
* 🕒 Activity tracking
* 📌 Pinned notes
* 🔄 Version management
* 🔐 Authentication
* 🏠 Collaborative coding rooms

---

# ✨ Key Features

## 🔐 Authentication

CoCode provides a secure authentication flow for users.

### Features

* User registration
* User login
* Logout
* Protected routes
* Authentication-based dashboard access
* User session management

### Flow

```text
Register / Login
       ↓
Authentication
       ↓
Dashboard
       ↓
Coding & Collaboration
```

---

# 🏠 Dashboard

After logging in, users can access the main dashboard.

### Dashboard Navigation

```text
Dashboard
│
├── Compiler
├── Create Room
├── Join Room
├── User Profile
└── Logout
```

The dashboard provides quick access to both personal coding and collaborative development.

---

# 💻 Personal Compiler

CoCode includes a personal compiler that can be used independently without creating or joining a collaboration room.

Users can:

* Select a programming language
* Write code
* Provide input
* Execute code
* View output
* View compilation errors
* View runtime errors

### Compiler Flow

```text
Select Language
       ↓
Write Code
       ↓
Provide Input
       ↓
Run Code
       ↓
Output / Error
```

---

# 👥 Collaborative Coding Rooms

CoCode allows users to create and join collaborative coding rooms.

## Create Room

A user can create a new room and share the generated room ID with other users.

## Join Room

Other users can join the workspace using the room ID.

### Collaboration Flow

```text
User A
  │
  ▼
Create Room
  │
  ▼
Room ID
  │
  ├───────────────┐
  │               │
  ▼               ▼
User B           User C
Join Room        Join Room
  │               │
  └───────┬───────┘
          ▼
 Shared Workspace
```

---

# 📝 Real-Time Collaborative Editor

The collaborative editor allows multiple users to work on code together.

### Features

* Real-time code synchronization
* Multi-user editing
* File switching
* Multiple files
* Shared workspace
* Programming language selection
* Real-time updates

Changes made by one user can be synchronized with other users in the same room.

---

# 📂 Multi-File Workspace

CoCode supports a multi-file coding environment.

Users can:

* Create files
* Open files
* Edit files
* Switch between files
* Manage project files
* Collaborate across multiple files

This allows users to work on larger projects rather than being limited to a single code file.

---

# ▶️ Code Execution

CoCode integrates online code execution capabilities so users can execute their programs directly from the platform.

### Execution Process

```text
Code
 ↓
Select Language
 ↓
Input
 ↓
Execute
 ↓
Compiler API
 ↓
Output
```

The platform is designed to support execution across multiple programming languages.

---

# 💬 Real-Time Chat

CoCode includes real-time communication inside collaborative workspaces.

Users can:

* Send messages
* Receive messages instantly
* Discuss code
* Share ideas
* Coordinate development
* Communicate with team members

This removes the need to switch between separate communication applications while coding.

---

# 🎨 Collaborative Drawing Board

CoCode provides a shared drawing/whiteboard environment.

It can be used for:

* Flowcharts
* Algorithms
* System architecture
* Project planning
* Diagrams
* Technical explanations

Users can visually explain ideas while collaborating on code.

---

# 👀 User Presence

The platform provides real-time user presence inside collaboration rooms.

Users can identify who is currently active in the workspace.

This improves collaboration and makes the shared coding environment more interactive.

---

# 🕒 Activity Timeline

CoCode provides activity tracking inside the collaborative workspace.

Examples include:

* User joined
* User left
* File changes
* Collaboration events
* Workspace activity

This helps users understand the progress and activity of the room.

---

# 📌 Pinned Notes

Important information can be maintained using pinned notes.

Pinned notes can be useful for:

* Tasks
* Instructions
* Requirements
* Coding reminders
* Meeting notes
* Important project information

---

# 🔄 Version Management

CoCode supports managing different versions of coding work.

Version management helps users:

* Track changes
* Maintain coding history
* Review previous work
* Manage development progress
* Preserve important code versions

---

# 🎨 Modern User Interface

CoCode provides a modern developer-focused interface.

### UI Highlights

* Responsive design
* Developer-friendly workspace
* Interactive dashboard
* Modern code editor
* Collaborative workspace
* Real-time updates
* Clean navigation
* Dark-themed coding experience

---

# 🛠️ Technology Stack

## Frontend

* React
* Vite
* JavaScript / JSX
* CodeMirror
* Tailwind CSS
* Socket.IO Client
* Tldraw

## Backend

* Node.js
* Express.js
* Socket.IO
* JWT Authentication
* REST APIs

## Code Execution

* External online compiler/execution APIs
* Judge0-compatible execution architecture

## Deployment

* Vercel — Frontend
* Render — Backend

## Development Tools

* Git
* GitHub
* VS Code
* npm

---

# 🏗️ System Architecture

```text
                         ┌───────────────────┐
                         │       User        │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │ Vercel Frontend   │
                         │   React + Vite    │
                         └─────────┬─────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
           ┌─────────────────┐          ┌─────────────────┐
           │    REST APIs    │          │    Socket.IO    │
           │ Authentication  │          │ Real-Time Sync │
           └────────┬────────┘          └────────┬────────┘
                    │                            │
                    └──────────────┬─────────────┘
                                   ▼
                         ┌───────────────────┐
                         │ Render Backend    │
                         │ Node + Express    │
                         └─────────┬─────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
             Authentication    Room Data    Code Execution
```

---

# 📁 Project Structure

```text
CoCode/
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── server.js
│   │
│   ├── data/
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── config/
│   │   └── App.jsx
│   │
│   ├── public/
│   ├── package.json
│   └── .env.example
│
├── render.yaml
├── vercel.json
├── .gitignore
└── README.md
```

---

# ⚙️ Environment Variables

## Frontend

Create:

```text
frontend/.env
```

Add:

```env
VITE_API_URL=https://cocode-backend-6lvi.onrender.com
VITE_SOCKET_URL=https://cocode-backend-6lvi.onrender.com
```

---

## Backend

Create:

```text
backend/.env
```

Add:

```env
NODE_ENV=production
PORT=10000

JWT_SECRET=your_secure_secret

FRONTEND_URL=https://co-code-ten.vercel.app
CORS_ORIGINS=https://co-code-ten.vercel.app
```

### ⚠️ Security

Never commit sensitive information to GitHub.

Do not upload:

```text
.env
Passwords
API Keys
JWT Secrets
Database Credentials
Private Tokens
```

Use `.env.example` files for configuration templates.

---

# 💻 Local Installation

## 1. Clone Repository

```bash
git clone https://github.com/jatinraghav22/CoCode.git
```

Move into the project:

```bash
cd CoCode
```

---

# 🔧 Backend Setup

Open a terminal:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create:

```text
.env
```

Configure your backend environment variables.

Start the backend:

```bash
npm start
```

---

# 🎨 Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create:

```text
.env
```

For local development, configure:

```env
VITE_API_URL=http://localhost:YOUR_BACKEND_PORT
VITE_SOCKET_URL=http://localhost:YOUR_BACKEND_PORT
```

Start the frontend:

```bash
npm run dev
```

Vite will display the local development URL in the terminal.

---

# 🚀 Production Deployment

CoCode uses a separated frontend and backend deployment architecture.

```text
                   CoCode
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
       Vercel                 Render
     Frontend                Backend
          │                     │
          ▼                     ▼
    React + Vite        Node + Express
                              │
                              ▼
                         Socket.IO
```

---

# ☁️ Vercel Frontend Deployment

The frontend is deployed on Vercel.

### Configuration

```text
Framework:
Vite

Root Directory:
frontend

Build Command:
npm run build

Output Directory:
dist
```

### Production Environment Variables

```env
VITE_API_URL=https://cocode-backend-6lvi.onrender.com
VITE_SOCKET_URL=https://cocode-backend-6lvi.onrender.com
```

---

# ☁️ Render Backend Deployment

The backend is deployed on Render.

### Configuration

```text
Root Directory:
backend

Runtime:
Node

Build Command:
npm install

Start Command:
npm start
```

### Production Environment Variables

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=your_secure_secret
FRONTEND_URL=https://co-code-ten.vercel.app
CORS_ORIGINS=https://co-code-ten.vercel.app
```

---

# ❤️ Backend Health Check

CoCode includes a backend health-check endpoint.

```text
/health
```

This endpoint can be used to verify that the backend service is running correctly.

---

# 🔌 Real-Time Communication

CoCode uses **Socket.IO** to provide real-time communication.

Socket.IO is used for:

* Collaborative code synchronization
* User presence
* Chat
* Drawing synchronization
* Room updates
* Activity updates

The production configuration supports:

```text
WebSocket
+
Polling Fallback
```

and automatic reconnection.

---

# 🔐 Authentication Architecture

```text
             User
               │
               ▼
        Register / Login
               │
               ▼
       Authentication
               │
               ▼
          JWT Token
               │
               ▼
       Protected Routes
               │
               ▼
           Dashboard
               │
       ┌───────┴────────┐
       ▼                ▼
   Compiler       Collaboration
                       │
                ┌──────┴──────┐
                ▼             ▼
             Create          Join
              Room           Room
```

---

# 👥 Collaboration Architecture

```text
                    Collaboration Room
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
          Code Editor      Chat        Drawing Board
             │              │              │
             └──────────────┼──────────────┘
                            │
                            ▼
                       Socket.IO
                            │
                            ▼
                    Real-Time Updates
```

---

# 🧪 Testing Checklist

Before production deployment, verify:

* [ ] Registration
* [ ] Login
* [ ] Logout
* [ ] Protected routes
* [ ] Dashboard
* [ ] Personal compiler
* [ ] Code execution
* [ ] Create room
* [ ] Join room
* [ ] Real-time code synchronization
* [ ] Multiple files
* [ ] Chat
* [ ] Drawing board
* [ ] User presence
* [ ] Activity timeline
* [ ] Pinned notes
* [ ] Version management
* [ ] API connectivity
* [ ] Socket.IO connectivity
* [ ] CORS configuration
* [ ] Responsive UI
* [ ] Production deployment

---

# 🐛 Troubleshooting

## API Connection Error

Check the frontend environment variables:

```env
VITE_API_URL
VITE_SOCKET_URL
```

Make sure both point to the correct backend URL.

---

## Socket.IO Connection Error

Check:

```env
VITE_SOCKET_URL
```

and backend:

```env
FRONTEND_URL
CORS_ORIGINS
```

The production frontend URL must be correctly configured.

---

## CORS Error

Verify the backend configuration:

```env
FRONTEND_URL=https://co-code-ten.vercel.app
CORS_ORIGINS=https://co-code-ten.vercel.app
```

Make sure the configured origin exactly matches the frontend deployment.

---

# 📊 Project Highlights

| Feature                 | Status |
| ----------------------- | ------ |
| 🔐 Authentication       | ✅      |
| 🏠 Dashboard            | ✅      |
| 💻 Personal Compiler    | ✅      |
| 👥 Collaborative Rooms  | ✅      |
| 📝 Real-Time Editing    | ✅      |
| 📂 Multi-File Workspace | ✅      |
| ▶️ Code Execution       | ✅      |
| 💬 Real-Time Chat       | ✅      |
| 🎨 Drawing Board        | ✅      |
| 👀 User Presence        | ✅      |
| 🕒 Activity Timeline    | ✅      |
| 📌 Pinned Notes         | ✅      |
| 🔄 Version Management   | ✅      |
| 📱 Responsive UI        | ✅      |
| ☁️ Vercel Deployment    | ✅      |
| ⚙️ Render Deployment    | ✅      |

---

# 🎯 Use Cases

CoCode can be used for:

### 👨‍💻 Pair Programming

Two or more developers can work on the same codebase in real time.

### 🎓 Student Projects

Students can collaborate on programming assignments and academic projects.

### 🧑‍🏫 Coding Classes

Teachers and students can use the shared workspace for demonstrations and learning.

### 🏆 Hackathons

Teams can collaborate remotely from a single coding environment.

### 💼 Technical Interviews

Candidates and interviewers can use a shared coding environment.

### 📚 Programming Practice

Students can write and execute code using the personal compiler.

### 🌐 Remote Development

Distributed teams can collaborate without being in the same physical location.

---

# 🚀 Future Improvements

Potential future improvements include:

* 🤖 AI-powered coding assistant
* 💡 AI code suggestions
* 🐛 AI debugging
* 📁 Cloud project storage
* 🔗 Git/GitHub integration
* 👥 Team workspaces
* 🔐 Advanced room permissions
* 🎤 Voice communication
* 📹 Video communication
* 📤 File upload/download
* 🔄 Advanced version control
* 🌍 Additional language support
* ⚡ Improved code execution
* 📊 Collaboration analytics

---

# 👨‍💻 Developer

## Jatin Raghav

**B.Tech Computer Science & Engineering**

### Interests

* Software Engineering
* Full Stack Development
* Real-Time Applications
* Cloud Computing
* Data Structures & Algorithms
* Web Development
* Collaborative Applications

### Connect With Me

**GitHub:**
https://github.com/jatinraghav22

**LinkedIn:**
https://www.linkedin.com/in/jatin-raghav-a9a060357/

**Portfolio:**
https://jatinraghav.vercel.app/

---

# ⭐ Support the Project

If you find **CoCode** useful, consider giving the repository a ⭐ on GitHub.

Your feedback, suggestions, and contributions are welcome.

---

# 📄 License

This project is developed for educational, development, and portfolio purposes.

---

<p align="center">
  <b>Built with ❤️ by Jatin Raghav</b>
</p>

<p align="center">
  🚀 Code Together • Build Together • Learn Together
</p>
