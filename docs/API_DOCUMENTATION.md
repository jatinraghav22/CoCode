# CoCode — Complete API Documentation (Backend V2)

Base URL: `https://cocode-backend-v2.onrender.com`<br>
Authentication: HTTP Bearer Token (`Authorization: Bearer <token>`)

---

## 1. System Health & Readiness

### `GET /api/health`
Liveness probe checking process uptime.
- **Auth**: None
- **Response**: `200 OK`
  ```json
  { "success": true, "service": "cocode-backend-v2", "status": "healthy", "uptime": 120 }
  ```

### `GET /api/ready`
Deep readiness probe verifying TiDB database connectivity.
- **Auth**: None
- **Response**: `200 OK` (Healthy) or `503 Service Unavailable` (Database unreachable)
  ```json
  { "success": true, "service": "cocode-backend-v2", "status": "ready", "checks": { "database": "healthy" } }
  ```

---

## 2. Authentication (`/api/auth`)

### `POST /api/auth/register`
Creates a new user account.
- **Rate Limit**: 10 requests / 15 min
- **Request Body**:
  ```json
  { "name": "Alice", "email": "alice@example.com", "password": "SecurePassword123" }
  ```
- **Response**: `201 Created`
  ```json
  { "success": true, "token": "...", "user": { "id": "...", "name": "Alice", "email": "alice@example.com" } }
  ```

### `POST /api/auth/login`
Authenticates existing user with email and password.
- **Rate Limit**: 20 requests / 15 min
- **Request Body**:
  ```json
  { "email": "alice@example.com", "password": "SecurePassword123" }
  ```
- **Response**: `200 OK` with JWT token.

### `GET /api/auth/me`
Retrieves safe profile of currently authenticated user.
- **Auth**: Required
- **Response**: `200 OK` with user object.

### `POST /api/auth/logout`
Stateless logout acknowledgment.
- **Auth**: None
- **Response**: `200 OK`

---

## 3. User & Profile (`/api/users` & `/api/user`)

### `GET /api/users/me` (alias: `GET /api/user/profile`)
- **Auth**: Required
- **Response**: `200 OK`

### `PATCH /api/users/me` (alias: `PUT /api/user/profile`)
Updates user's display name.
- **Auth**: Required
- **Request Body**: `{ "name": "New Name" }`
- **Response**: `200 OK` with updated profile.

> [!NOTE]
> The backend manages and cloud-persists core identity fields (`id`, `name`, `email`, `role`, `createdAt`). Additional customizable profile fields (`username`, `bio`, `phone`, `location`, `skills`, `socialLinks`, `avatarUrl`) are stored locally on the client in browser `localStorage` isolated per user ID and merged client-side. They do not automatically sync across separate browsers or devices.

### `PATCH /api/users/me/password`
Changes account password.
- **Auth**: Required
- **Rate Limit**: 15 requests / 15 min
- **Request Body**:
  ```json
  { "currentPassword": "OldPassword123", "newPassword": "NewPassword456" }
  ```
- **Response**: `200 OK`

---

## 4. Projects & Workspaces (`/api/projects`)

All project endpoints enforce strict ownership (`project.userId === req.userId`).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/projects` | Creates new project with default starter file |
| `GET` | `/api/projects` | Lists paginated projects with optional `search` query |
| `GET` | `/api/projects/:id` | Gets single project with all its files |
| `PUT` | `/api/projects/:id` | Updates project name, description, or defaultLanguage |
| `DELETE` | `/api/projects/:id` | Deletes project and cascades to all files |
| `POST` | `/api/projects/:id/files` | Creates new file in project (path traversal protected) |
| `GET` | `/api/projects/:id/files/:fileId` | Retrieves file content |
| `PUT` | `/api/projects/:id/files/:fileId` | Updates file content, path, or language |
| `DELETE` | `/api/projects/:id/files/:fileId` | Deletes file |
| `POST` | `/api/projects/:id/folders` | Creates folder with `.cocode-keep` placeholder |
| `PUT` | `/api/projects/:id/folders` | Renames folder and updates nested file paths |
| `DELETE` | `/api/projects/:id/folders` | Deletes folder and all nested files |
| `GET` | `/api/projects/:id/search` | Search text across all project files |
| `PUT` | `/api/projects/:id/save-all` | Batch saves modified files transactionally |

---

## 5. Collaboration Rooms (`/api/rooms`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rooms` | Creates room with 6-char code and default documents |
| `POST` | `/api/rooms/join` | Enrolls authenticated user into room |
| `GET` | `/api/rooms/:code` | Returns room info for enrolled participants |
| `GET` | `/api/rooms/:code/documents` | Returns persistent room documents and Yjs state |

---

## 6. Remote Code Execution (`/api/compiler`)

### `GET /api/compiler/languages`
Returns list of 5 supported languages and Judge0 metadata.
- **Auth**: Optional (accessible to both guests and authenticated users)

### `POST /api/compiler/run`
Executes source code in an isolated Judge0 sandbox.
- **Auth**: Optional
  - **Guests**: Execution without `Authorization` header succeeds. No activity logs or user accounts created. IP-based rate limiting applied.
  - **Authenticated Users**: Providing a valid `Bearer <JWT>` executes code and logs user activity to the database. Invalid/expired/revoked tokens are rejected with `401 Unauthorized`.
- **Rate Limit**: 20 requests / min (keyed per `user_${userId}` for authenticated users, `guest_ip_${ip}` for guests)
- **Request Body**:
  ```json
  {
    "language": "python",
    "sourceCode": "print('Hello, World!')",
    "stdin": ""
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "stdout": "Hello, World!\n",
    "stderr": null,
    "compileOutput": null,
    "status": "Accepted",
    "data": {
      "language": "python",
      "stdout": "Hello, World!\n",
      "status": { "id": 3, "description": "Accepted" },
      "time": "0.021",
      "memory": 3400
    }
  }
  ```

---

## 7. Socket.IO Real-Time Protocol

- **Connection URL**: `wss://cocode-backend-v2.onrender.com`
- **Handshake Auth**: `auth: { token: "<JWT>" }`

### Client Events Emitted
- `room:join`: `{ roomCode: "X9K2PQ" }`
- `yjs:update`: `{ fileId: "f-1", update: [Uint8Array bytes] }`
- `code:update`: `{ fileId: "f-1", content: "...", language: "javascript" }`
- `room:sync`: `{}`
- `room:leave`: `{}`
- `chat:message`: `{ text: "Hello team" }`

### Server Events Received
- `room:joined`: `{ roomCode, state, presence }`
- `yjs:update`: `{ fileId, update, sentBy }`
- `code:update`: `{ fileId, content, language, sentBy }`
- `user:joined` / `user:left`: `{ userId, userName }`
- `user:presence`: `{ presence: [...] }`
- `chat:message`: `{ id, senderId, senderName, text, timestamp }`
- `room:error`: `{ message }`
