# CoCode Collaboration API & Architecture Documentation (Phase 6)

## Overview

Phase 6 implements **Real-Time Collaboration** in CoCode Backend V2. It enables multiple authenticated users to create and join shared coding rooms, simultaneously edit files in the Monaco Editor with real-time bidirectional synchronization, view live participant presence, and communicate through room chat.

---

## 1. Architecture

```
               ┌─────────────────────────────────────────────────────┐
               │                  React Client (Vite)                │
               │  - Monaco Editor + y-monaco (MonacoBinding)         │
               │  - Yjs Document Client (Y.Doc & Y.Text)             │
               │  - RoomPage.jsx (Create / Join Rooms)               │
               │  - EditorPage.jsx (Collaborative IDE & Chat)        │
               └──────────────┬───────────────────────▲──────────────┘
                              │                       │
           HTTP (REST API)    │                       │  Socket.IO (WebSocket)
      Authorization: Bearer   │                       │  auth: { token: JWT }
                              ▼                       │
               ┌──────────────────────────────────────┴──────────────┐
               │               CoCode Backend V2 (Express)           │
               │                                                     │
               │  HTTP REST Routes:                                  │
               │  - POST /api/rooms                                  │
               │  - POST /api/rooms/join                             │
               │  - GET  /api/rooms/:code                            │
               │  - GET  /api/rooms/:code/documents                  │
               │                                                     │
               │  Socket.IO Gateway & Yjs Sync:                      │
               │  - Handshake JWT Verification                       │
               │  - Persistent Room Authorization                    │
               │  - Yjs Incremental CRDT Updates (yjs:update)        │
               │  - Legacy Code Updates (code:update)                │
               │  - Multi-tab Presence Manager                       │
               └──────────────┬───────────────────────┬──────────────┘
                              │                       │
           In-Memory Y.Doc &  │                       │ Prisma ORM (MySQL)
           Debounced Flush    │                       │ SSL Strict
                              ▼                       ▼
               ┌──────────────────────┐    ┌───────────────────────────┐
               │    RoomStateStore    │    │        TiDB Cloud         │
               │  - Y.Doc per room    │    │  - users                  │
               │  - In-Memory Cache   │    │  - collaboration_rooms    │
               │  - Debounced DB Save ◄────┼──► room_participants      │
               │  - Active Sockets    │    │  - room_documents (LText) │
               └──────────────────────┘    └───────────────────────────┘
```

---

## 2. Room Management REST APIs

All room management endpoints require an `Authorization: Bearer <token>` header with a valid JWT access token.

### 2.1 Create Room

Creates a new collaboration room. The creator is automatically designated as the room owner and registered as the first participant.

- **Endpoint:** `POST /api/rooms`
- **Authentication:** Required (Bearer JWT)
- **Rate Limit:** 10 room creations per 15 minutes per IP

#### Request Payload
```json
{
  "roomName": "Algorithm Sprint Team",
  "isPrivate": true
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Room created successfully.",
  "room": {
    "id": "cuid_abc123",
    "code": "X9K2PQ",
    "name": "Algorithm Sprint Team",
    "isPrivate": true,
    "isActive": true,
    "createdAt": "2026-11-19T10:15:00.000Z",
    "updatedAt": "2026-11-19T10:15:00.000Z",
    "owner": {
      "id": "usr_owner123",
      "name": "Alice Developer"
    },
    "participants": [
      {
        "id": "part_1",
        "userId": "usr_owner123",
        "name": "Alice Developer",
        "joinedAt": "2026-11-19T10:15:00.000Z"
      }
    ],
    "hostName": "Alice Developer",
    "members": ["Alice Developer"]
  }
}
```

---

### 2.2 Join Room

Enrolls an authenticated user into an existing active collaboration room. Generates a persistent participant record in TiDB. Idempotent: rejoining an already-joined room succeeds without creating duplicate records.

- **Endpoint:** `POST /api/rooms/join`
- **Authentication:** Required (Bearer JWT)
- **Rate Limit:** 30 attempts per 15 minutes per IP

#### Request Payload
```json
{
  "roomCode": "X9K2PQ"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Joined room successfully.",
  "room": {
    "id": "cuid_abc123",
    "code": "X9K2PQ",
    "name": "Algorithm Sprint Team",
    "isPrivate": true,
    "isActive": true,
    "createdAt": "2026-11-19T10:15:00.000Z",
    "updatedAt": "2026-11-19T10:15:00.000Z",
    "owner": {
      "id": "usr_owner123",
      "name": "Alice Developer"
    },
    "participants": [
      { "id": "part_1", "userId": "usr_owner123", "name": "Alice Developer", "joinedAt": "..." },
      { "id": "part_2", "userId": "usr_bob456", "name": "Bob Programmer", "joinedAt": "..." }
    ],
    "hostName": "Alice Developer",
    "members": ["Alice Developer", "Bob Programmer"]
  }
}
```

---

### 2.4 Get Room Documents

Retrieves all persistent files and their content stored in TiDB Cloud for the room. Available only to enrolled participants.

- **Endpoint:** `GET /api/rooms/:code/documents`
- **Authentication:** Required (Bearer JWT)
- **Status Codes:**
  - `200 OK`: Documents retrieved successfully.
  - `400 Bad Request`: Invalid room code.
  - `403 Forbidden`: User is not a participant in this room.
  - `404 Not Found`: Room does not exist.

#### Response (200 OK)
```json
{
  "success": true,
  "documents": [
    {
      "fileId": "1",
      "filename": "index.js",
      "language": "javascript",
      "content": "// CoCode Collaboration Workspace\nconsole.log('Welcome to CoCode!');\n",
      "updatedAt": "2026-11-19T10:15:00.000Z"
    }
  ]
}
```

---

Returns room metadata. Available only to enrolled participants of that room.

- **Endpoint:** `GET /api/rooms/:code`
- **Authentication:** Required (Bearer JWT)
- **Status Codes:**
  - `200 OK`: User is an authorized member.
  - `400 Bad Request`: Invalid room code format.
  - `403 Forbidden`: User is authenticated but is not an enrolled member of this room.
  - `404 Not Found`: Room does not exist.

---

## 3. Socket.IO Gateway & Authentication

### 3.1 Handshake Authentication

Every Socket.IO connection is authenticated before being admitted:

1. The client supplies the JWT token in `auth: { token: "<JWT>" }` or in the `Authorization: Bearer <token>` handshake header.
2. The server middleware verifies the signature, expiration, issuer (`cocode-backend-v2`), and audience (`cocode-client`).
3. The user ID is extracted strictly from the JWT `sub` claim.
4. The user's existence in TiDB is confirmed via Prisma.
5. The authenticated `userId` and `userName` are pinned to `socket.userId` and `socket.userName`.
6. Connections with invalid, missing, or expired tokens are immediately rejected with an `Authentication error`.

### 3.2 Room Authorization

Before a socket is allowed to receive or send events in a room, the server checks `roomService.isParticipant(roomCode, socket.userId)` against TiDB. Unenrolled sockets are rejected with `room:error: "You are not a participant in this room"`.

---

## 4. Socket.IO Event Reference

### 4.1 Client to Server Events

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ roomCode: string }` | Enters a Socket.IO room and requests initial state snapshot (including base64 Yjs update). |
| `join-room` | `{ roomCode: string, displayName?: string }` | Backward-compatible alias for `room:join`. |
| `yjs:update` | `{ fileId: string, update: string \| Uint8Array }` | Incremental Yjs CRDT binary document update (base64 or buffer). |
| `code:update` | `{ fileId: string, content: string, language?: string }` | Sends full/partial code edits to the room (max 200 KB). |
| `code-change` | `{ roomCode?: string, fileId: string, content: string }` | Backward-compatible alias for `code:update`. |
| `room:sync` | `{}` | Re-requests the full authoritative room state (e.g. after reconnection). |
| `room:leave` | `{}` | Gracefully leaves the active room. |
| `chat:message` | `{ text: string }` | Sends a message to the room chat (max 2000 chars). |
| `chat-message` | `{ message: { text: string } }` | Backward-compatible alias for `chat:message`. |

### 4.2 Server to Client Events

| Event | Payload | Description |
|---|---|---|
| `room:joined` | `{ roomCode: string, state: Object, presence: Array, yjsUpdate: string }` | Emitted to the joining socket with current authoritative state, base64 Yjs binary document, and members. |
| `yjs:update` | `{ fileId: string, update: string }` | Incremental Yjs CRDT binary update broadcast to all other participants. |
| `room-update` | `{ members: string[], room: string }` | Backward-compatible presence event for existing frontend views. |
| `room:state` | `{ state: Object, presence: Array, yjsUpdate: string }` | Emitted in response to `room:sync`. |
| `code:update` | `{ fileId: string, content: string, language: string, sentBy: string }` | Broadcast to all OTHER participants when someone edits code. |
| `code-change` | `{ fileId: string, content: string }` | Backward-compatible code change event. |
| `user:joined` | `{ userId: string, userName: string }` | Broadcast when a new participant enters the room. |
| `user:left` | `{ userId: string, userName: string }` | Broadcast when a participant leaves or disconnects (all tabs closed). |
| `user:presence` | `{ presence: Array<{ userId: string, userName: string }> }` | Broadcast with the complete list of currently active participants. |
| `chat:message` | `{ id: string, senderId: string, senderName: string, text: string, timestamp: string }` | Broadcast to all members when a chat message is sent. |
| `room:error` | `{ message: string }` | Emitted when an action fails (e.g., unauthorized access, payload too large). |

---

## 5. Synchronization & Concurrency Design

### 5.1 Authoritative Server State (`RoomStateStore`)

1. The server maintains an in-memory `RoomStateStore` tracking the current content of all active files per room.
2. When a participant joins, the server delivers the current snapshot (`room:joined` -> `state.files`). The client initializes its editor tabs from this snapshot.
3. When any participant modifies code, `code:update` writes the update to `RoomStateStore` and broadcasts to `socket.to(roomCode)` (all sockets in the room **except** the sender).

### 5.2 Echo Prevention

To prevent infinite broadcast loops:
- The server uses `socket.to(roomCode).emit(...)`, which Socket.IO natively routes to all room members **excluding** the sender.
- On the client side (`EditorPage.jsx`), an `isRemoteUpdateRef` flag is toggled on during incoming socket updates. When the Monaco editor's `onChange` callback fires as a result of a remote update, `isRemoteUpdateRef.current` blocks re-emitting the event back to the server.

### 5.3 Multi-Tab Disconnect Safety

A single user might have multiple tabs open to the same collaboration room:
- The server tracks active socket IDs per `(roomCode, userId)`.
- When a socket disconnects, the server counts how many other sockets for that `userId` remain connected in the room.
- `user:left` is **only** broadcast when `remainingSockets === 0`. Closing one tab while another remains open does not falsely mark the user offline.

---

## 6. Database Schema Design

The migration adds three models to the existing Prisma schema in TiDB Cloud: `CollaborationRoom`, `RoomParticipant`, and `RoomDocument`. The existing `users` table is preserved untouched.

```prisma
model CollaborationRoom {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  isPrivate Boolean  @default(true)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ownerId   String
  owner     User   @relation("RoomOwner", fields: [ownerId], references: [id])

  participants RoomParticipant[] @relation("RoomParticipants")
  documents    RoomDocument[]    @relation("RoomDocuments")

  @@index([code])
  @@index([ownerId])
  @@map("collaboration_rooms")
}

model RoomParticipant {
  id        String   @id @default(cuid())
  roomId    String
  userId    String
  joinedAt  DateTime @default(now())
  updatedAt DateTime @updatedAt

  room      CollaborationRoom @relation("RoomParticipants", fields: [roomId], references: [id])
  user      User              @relation("ParticipantUser",  fields: [userId],  references: [id])

  @@unique([roomId, userId])
  @@index([roomId])
  @@index([userId])
  @@map("room_participants")
}

model RoomDocument {
  id        String   @id @default(cuid())
  roomId    String
  fileId    String
  filename  String
  language  String   @default("javascript")
  content   String   @db.LongText
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  room      CollaborationRoom @relation("RoomDocuments", fields: [roomId], references: [id], onDelete: Cascade)

  @@unique([roomId, fileId])
  @@index([roomId])
  @@map("room_documents")
}
```

---

## 7. How to Test Collaboration Locally

You can test real-time collaboration using two browser windows (e.g. Chrome normal + Chrome Incognito):

### Step 1: Start Backend V2
```bash
cd server-v2
npm start
```
Verify the output:
```
CoCode Backend V2 running on port 5000
Socket.IO: enabled (real-time collaboration active)
Health: http://localhost:5000/api/health
```

### Step 2: Start Client
```bash
cd client
npm run dev
```
Open `http://localhost:5173` in your browser.

### Step 3: Session A (Host)
1. Sign in as User A (`alice@cocode.dev`).
2. Navigate to **Collaborate / Create Room** (`/rooms/create`).
3. Enter room name (e.g. `Hackathon Room`) and click **Create verified room**.
4. Note the generated 6-character room code (e.g. `X9K2PQ`) or click the copy icon.
5. Click **Launch Online IDE** (`/editor/X9K2PQ`).
6. Notice the topbar: green dot with `1 Online`.

### Step 4: Session B (Participant)
1. In an Incognito window, go to `http://localhost:5173`.
2. Sign in as User B (`bob@cocode.dev`).
3. Navigate to **Join Room** (`/rooms/join`).
4. Enter the room code (`X9K2PQ`) and click **Join verified room**.
5. Click **Enter Room IDE**.
6. Notice:
   - User A sees `2 Online` in the topbar and receives a notification in the chat panel.
   - User B sees `2 Online` in the topbar.
   - User A types code in the Monaco editor: changes immediately appear on User B's screen in real time.
   - User B types code: changes immediately appear on User A's screen.
   - Open the **Chat** panel on both screens: send a message from User A, and User B sees it instantly.
   - Click **Leave** on User B: User A immediately sees presence drop to `1 Online` and receives a leave notification.
