# 🚀 CoCode — Real-Time Collaborative Coding Platform

<p align="center">
  <b>Code Together. Collaborate in Real Time. Build Faster.</b>
</p>

<p align="center">
  A modern real-time collaborative coding platform that allows developers to write, execute, discuss, and manage code together from anywhere.
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

**CoCode** is a real-time collaborative coding platform designed for developers, students, and teams who want to work together on programming projects.

The platform provides a shared coding environment where users can:

* 👥 Collaborate in real time
* 💻 Write and edit code
* 📁 Manage multiple files
* ▶️ Execute code
* 💬 Communicate through chat
* 🎨 Collaborate using a drawing board
* 👀 See active users and presence
* 🕒 Track coding activity
* 🔖 Create and manage pinned notes
* 🔄 Maintain code/version history
* 🌐 Work from anywhere through the deployed web application

CoCode combines coding, communication, collaboration, and execution into one unified real-time workspace.

---

# ✨ Key Features

## 🔐 Authentication

* User registration
* Secure login
* Logout functionality
* Protected application routes
* User session management

---

## 🏠 Dashboard

After successful authentication, users can access the main dashboard.

### Dashboard Navigation

```text
Dashboard
├── Compiler
├── Create Room
├── Join Room
├── User Profile
└── Logout
```

The dashboard provides quick access to both personal coding and collaborative features.

---

# 💻 Personal Compiler

CoCode provides a personal compiler environment where users can write and execute code without creating or joining a collaboration room.

### Features

* Code editor
* Programming language selection
* Code execution
* Input/output handling
* Compilation result
* Error output
* Independent coding environment

The compiler can be used separately from collaborative rooms.

---

# 👥 Real-Time Collaboration

Users can create or join collaborative coding rooms.

### Create Room

A user can create a new room and share the room ID with other users.

### Join Room

Other users can join an existing room using the room ID.

### Collaboration Features

* Real-time code synchronization
* Multiple users
* User presence
* Shared files
* Real-time communication
* Shared drawing board
* Activity tracking
* Version management

---

# 📝 Collaborative Code Editor

CoCode provides a shared coding workspace where multiple users can work together.

Users can:

* Create files
* Edit files
* Switch between files
* Synchronize changes
* Work on code simultaneously
* Manage different programming languages

Changes are synchronized in real time using **Socket.IO**.

---

# 📂 Multi-File Workspace

The platform supports a multi-file coding environment.

Users can:

* Create new files
* Open files
* Edit files
* Switch between files
* Manage project files
* Collaborate on multiple files

This makes the workspace suitable for larger coding projects rather than a single-file compiler.

---

# ▶️ Code Execution

CoCode supports online code execution through external compiler/execution APIs.

Users can:

1. Select a programming language
2. Write code
3. Provide input
4. Run the code
5. View output
6. View compilation/runtime errors

The platform is designed to support execution across multiple programming languages.

---

# 💬 Real-Time Chat

Each collaborative workspace can be used for communication between team members.

Users can:

* Send messages
* Receive messages in real time
* Discuss code
* Share ideas
* Coordinate development work

---

# 🎨 Collaborative Drawing Board

CoCode includes a collaborative drawing/whiteboard environment.

It can be used for:

* Flowcharts
* System architecture
* Algorithms
* Diagrams
* Project planning
* Explaining concepts

Users can visually communicate ideas while working together.

---

# 👀 User Presence

The platform provides real-time awareness of users inside a collaboration room.

Users can see who is currently participating in the workspace.

This makes collaboration more interactive and similar to working together in a shared physical environment.

---

# 🕒 Activity Timeline

CoCode can maintain activity information related to collaborative work.

Examples include:

* User joined
* User left
* File changes
* Collaboration activity
* Room activity

This helps users understand what is happening inside the workspace.

---

# 📌 Pinned Notes

Users can maintain important notes inside the collaborative environment.

Pinned notes can be used for:

* Important instructions
* Tasks
* Meeting notes
* Coding reminders
* Project requirements

---

# 🔄 Version Management

CoCode provides functionality for maintaining different versions of coding work.

This helps users:

* Track previous changes
* Maintain coding history
* Restore previous work
* Manage development progress

---

# 🎨 User Interface

The application focuses on a modern developer-oriented interface with:

* Responsive layout
* Dark developer-friendly interface
* Modern code editor
* Interactive collaboration workspace
* Real-time UI updates
* Dashboard-based navigation

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

# 🏗️ Project Architecture

```text
                    ┌─────────────────────┐
                    │       User          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Vercel Frontend   │
                    │      React + Vite   │
                    └──────────┬──────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
        ┌──────────────────┐      ┌──────────────────┐
        │    REST APIs     │      │    Socket.IO     │
        │     Backend      │      │ Real-Time Sync   │
        └────────┬─────────┘      └────────┬─────────┘
                 │                         │
                 └────────────┬────────────┘
                              ▼
                    ┌─────────────────────┐
                    │  Render Backend     │
                    │ Node + Express      │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
          Authentication   Room Data     Code Execution
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

Never upload the following to GitHub:

```text
.env
API keys
Passwords
JWT secrets
Private credentials
Database credentials
```

Use `.env.example` files for public configuration examples.

---

# 💻 Run CoCode Locally

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

Create your environment file:

```text
.env
```

Configure the required environment variables.

Start the backend:

```bash
npm start
```

The backend will start using the configured port.

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

Add:

```env
VITE_API_URL=http://localhost:YOUR_BACKEND_PORT
VITE_SOCKET_URL=http://localhost:YOUR_BACKEND_PORT
```

Start the frontend:

```bash
npm run dev
```

Vite will provide the local development URL in the terminal.

---

# 🚀 Deployment

CoCode uses a separated deployment architecture.

```text
Frontend
   ↓
Vercel
   ↓
React + Vite

Backend
   ↓
Render
   ↓
Node.js + Express + Socket.IO
```

---

# ☁️ Frontend Deployment — Vercel

The frontend is deployed using Vercel.

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

### Environment Variables

```env
VITE_API_URL=https://cocode-backend-6lvi.onrender.com
VITE_SOCKET_URL=https://cocode-backend-6lvi.onrender.com
```

---

# ☁️ Backend Deployment — Render

The backend is deployed using Render.

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

### Environment Variables

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=your_secure_secret
FRONTEND_URL=https://co-code-ten.vercel.app
CORS_ORIGINS=https://co-code-ten.vercel.app
```

---

# ❤️ Health Check

The backend provides a health-check endpoint:

```text
/health
```

This can be used to verify that the backend service is running correctly.

---

# 🔌 Real-Time Communication

CoCode uses **Socket.IO** for real-time communication.

Socket connections are used for features such as:

* Collaborative editing
* User presence
* Chat
* Drawing synchronization
* Room updates
* Real-time activity

The production configuration supports:

```text
WebSocket
+
Polling fallback
```

with automatic reconnection support.

---

# 🔐 Authentication Flow

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
 ├── Compiler
 ├── Create Room
 └── Join Room
```

---

# 👥 Collaboration Flow

```text
User A
   │
   ├── Create Room
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
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
   Code   Chat  Drawing
     │
     ▼
Real-Time Synchronization
```

---

# 🧪 Testing Checklist

Before production deployment, verify:

* [ ] User registration
* [ ] User login
* [ ] Logout
* [ ] Protected routes
* [ ] Dashboard
* [ ] Personal compiler
* [ ] Create room
* [ ] Join room
* [ ] Real-time code synchronization
* [ ] Multiple files
* [ ] Chat
* [ ] Drawing board
* [ ] User presence
* [ ] Activity timeline
* [ ] Version management
* [ ] Code execution
* [ ] Production API connection
* [ ] Socket.IO connection
* [ ] CORS configuration
* [ ] Responsive UI

---

# 🐛 Troubleshooting

## API Error

If the frontend cannot communicate with the backend, verify:

```env
VITE_API_URL
```

and make sure it points to the deployed backend.

---

## Socket Connection Error

Verify:

```env
VITE_SOCKET_URL
```

and backend:

```env
FRONTEND_URL
CORS_ORIGINS
```

Both should contain the correct production frontend URL.

---

## CORS Error

Make sure the backend allows the exact frontend origin.

Example:

```env
FRONTEND_URL=https://co-code-ten.vercel.app
CORS_ORIGINS=https://co-code-ten.vercel.app
```

Do not add unnecessary trailing slashes if the application expects the origin without one.

---

# 📊 Project Highlights

| Feature              | Status |
| -------------------- | ------ |
| Authentication       | ✅      |
| Dashboard            | ✅      |
| Personal Compiler    | ✅      |
| Collaborative Rooms  | ✅      |
| Real-Time Editing    | ✅      |
| Multi-File Workspace | ✅      |
| Code Execution       | ✅      |
| Real-Time Chat       | ✅      |
| Drawing Board        | ✅      |
| User Presence        | ✅      |
| Activity Timeline    | ✅      |
| Pinned Notes         | ✅      |
| Version Management   | ✅      |
| Responsive UI        | ✅      |
| Vercel Deployment    | ✅      |
| Render Deployment    | ✅      |

---

# 🎯 Use Cases

CoCode can be useful for:

* 👨‍💻 Pair programming
* 👥 Team development
* 🎓 Student projects
* 🧑‍🏫 Coding classes
* 💻 Coding interviews
* 🏆 Hackathons
* 📚 Learning programming
* 🌐 Remote collaboration

---

# 🚀 Future Improvements

Planned improvements may include:

* Advanced project management
* More programming languages
* Improved code execution
* File upload/download
* Git integration
* Team workspaces
* Advanced permissions
* Voice/video communication
* AI-powered coding assistance
* Code suggestions
* Improved version control
* Cloud project storage

---

# 👨‍💻 Developer

## Jatin Raghav

**B.Tech Computer Science & Engineering**

Interested in:

* Software Engineering
* Full Stack Development
* Real-Time Applications
* Cloud Computing
* Data Structures & Algorithms
* Modern Web Technologies

### Connect With Me

**GitHub:**
https://github.com/jatinraghav22

**LinkedIn:**
https://www.linkedin.com/in/jatin-raghav-a9a060357/

**Portfolio:**
https://jatinraghav.vercel.app/

---

# ⭐ Support

If you find **CoCode** useful, consider giving the repository a ⭐ on GitHub.

Your feedback and suggestions are always welcome.

---

# 📄 License

This project is created for educational, development, and portfolio purposes.

---

<p align="center">
  <b>Built with ❤️ by Jatin Raghav</b>
</p>

<p align="center">
  🚀 Code Together • Build Together • Learn Together
</p>
