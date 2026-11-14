# CoCode – Real-Time Collaborative Code Editor

<p align="center">
  <strong>Code Together. Learn Together. Build Together.</strong>
</p>

<p align="center">
  A full-stack collaborative coding platform designed to make coding and teamwork easier through real-time collaboration.
</p>

<p align="center">
  <a href="https://https://getcocode.vercel.app/">Live Demo</a> •
  <a href="https://github.com/jatinraghav22/CoCode">GitHub Repository</a> •
  <a href="https://cocode-2l13.onrender.com/">Backend API</a>
</p>

---

## About CoCode

**CoCode** is a web-based collaborative coding platform that allows developers and students to work together in a shared coding environment.

The project aims to simplify collaborative programming by providing a platform where users can create coding rooms, connect with other developers, and write code together.

Whether you are practising programming, learning with friends, or working on a coding task, CoCode provides a common environment for collaboration.

## Key Features

- **User Authentication:** Secure user registration and login.
- **Collaborative Coding Rooms:** Create and join coding rooms for collaborative sessions.
- **Real-Time Communication:** Built with Socket.IO to support real-time interaction.
- **Code Editor:** Monaco Editor provides a familiar code-editing experience.
- **Responsive Interface:** Clean and user-friendly interface for different screen sizes.
- **Full-Stack Architecture:** Separate frontend and backend for better project organization.
- **Database Integration:** MySQL and Prisma ORM for structured data management.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Styling | CSS |
| Code Editor | Monaco Editor |
| Backend | Node.js, Express.js |
| Real-Time Communication | Socket.IO |
| Database | MySQL |
| ORM | Prisma |
| Authentication | JWT |
| Deployment | Vercel, Render |
| Version Control | Git & GitHub |

## Project Structure

```text
CoCode/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── assets/
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── ...
│   └── package.json
│
├── .gitignore
└── README.md
```

## Getting Started

Follow these steps to run CoCode locally.

### 1. Clone the Repository

```bash
git clone https://github.com/jatinraghav22/CoCode.git
```

### 2. Navigate to the Project

```bash
cd CoCode
```

### 3. Install Frontend Dependencies

```bash
cd client
npm install
```

### 4. Install Backend Dependencies

Open another terminal:

```bash
cd CoCode/server
npm install
```

### 5. Configure Environment Variables

Create the required `.env` file in the `server/` directory (see `server/.env.example` for reference).

Environment variables:

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | `mysql://USER:PASSWORD@localhost:3306/cocode_db` |
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Environment mode | `development` (or `production`, `test`) |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | Random 32+ char secret |
| `JWT_EXPIRES_IN` | JWT token lifetime | `7d` |
| `JWT_ISSUER` | JWT issuer claim (`iss`) | `cocode-api` |
| `JWT_AUDIENCE` | JWT audience claim (`aud`) | `cocode-client` |
| `CLIENT_URL` | Allowed CORS origins (comma-separated) | `http://localhost:5173,https://getcocode.vercel.app` |
| `JUDGE0_BASE_URL` | Judge0 compiler endpoint | `https://ce.judge0.com` |

*Never commit `.env` files or hardcode secrets in source code.*

### 6. Configure Database & Migrations

From the `server/` directory:

```bash
cd server
npx prisma generate
npx prisma migrate dev
```

### 7. Run Automated Tests

Run the comprehensive unit, static security, and integration test suite:

```bash
cd server
npm test
```

### 8. Start the Application

Start backend and frontend in separate terminals:

Backend:
```bash
cd server
npm run dev
```

Frontend:
```bash
cd client
npm run dev
```

Open your browser to `http://localhost:5173`.

## Authentication & Security Architecture

CoCode Phase 2 implements enterprise-grade authentication and API hardening:

- **Database-Backed Session Revocation:** While JWTs are stateless, CoCode persists hashed tokens (`SHA-256`) in MySQL (`AuthSession` table). Logout marks the session as revoked, preventing token reuse before expiration.
- **Single & Multi-Device Logout:**
  - `POST /api/auth/logout`: Revokes the current device session.
  - `POST /api/auth/logout-all`: Revokes all active sessions for the user.
- **Collision-Proof Tokens:** Each token includes a cryptographic `jti` (UUID), ensuring uniqueness even during rapid successive logins.
- **Strict Claims Verification:** Tokens are verified for signature, expiry, `iss` (`cocode-api`), and `aud` (`cocode-client`).
- **Cryptographic Password Hashing:** Node.js `crypto.scrypt` with unique cryptographically random salts and timing-safe comparisons.
- **Authenticated Socket.IO:** Real-time collaboration sockets require a valid, non-revoked JWT during handshake (`io.use(socketAuth)`). Identity is loaded from the database, preventing client spoofing.
- **Rate Limiting & Protection:** Endpoint-specific rate limiting (`express-rate-limit`) on login (20/15m) and registration (10/1h), plus security headers (`helmet`) and origin-restricted CORS.

## Deployment

CoCode is deployed using the following platforms:

| Component | Platform | Link |
|---|---|---|
| Frontend | Vercel | https://getcocode.vercel.app/ |
| Backend | Render | https://cocode-2l13.onrender.com/ |
| Source Code | GitHub | https://github.com/jatinraghav22/CoCode |

## Future Improvements

- Enhanced real-time multi-user code synchronization.
- Support for multiple programming languages.
- Integrated code execution environment.
- Voice and video communication.
- Collaborative debugging.
- Improved user profiles and session management.
- Enhanced security and database integration.

## Learning Outcomes

Working on CoCode provides practical experience with:

- Full-stack web development.
- React component-based architecture.
- REST API development.
- Real-time communication using Socket.IO.
- Database design and ORM concepts.
- Authentication and authorization.
- Cloud deployment and version control.

## Author

**Jatin Raghav**

B.Tech – Computer Science and Engineering

- GitHub: [@jatinraghav22](https://github.com/jatinraghav22)
- LinkedIn: [Jatin Raghav](https://www.linkedin.com/in/jatin-raghav-a9a060357/)

---

<p align="center">
  <strong>CoCode – Code Together. Grow Together. 🚀</strong>
</p>
