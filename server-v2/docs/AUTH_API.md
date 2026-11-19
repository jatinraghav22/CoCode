# CoCode Backend V2 — Authentication API Documentation

## Overview
This document specifies the Phase 3 Authentication & User Management API for CoCode Backend V2.
The authentication system is built using:
- **Framework**: Express.js (Node.js CommonJS)
- **Database / ORM**: TiDB Cloud (MySQL compatible) with Prisma ORM 6.19.3
- **Password Hashing**: `bcryptjs` (salt rounds: 10)
- **Token Format**: JSON Web Tokens (`jsonwebtoken`) signed with HS256 and verified using configurable secret, issuer, and audience claims
- **Rate Limiting**: In-memory sliding window rate limiting per IP

---

## Authentication Mechanism
All protected endpoints require a valid JWT passed in the HTTP `Authorization` header:

```http
Authorization: Bearer <jwt_access_token>
```

### Token Payload Structure
The JWT access token contains standard claims:
- `sub`: The unique User ID (`id` from database)
- `email`: Normalized email of the user
- `name`: User's display name
- `iss`: Issuer (`cocode-backend-v2` by default)
- `aud`: Audience (`cocode-client` by default)
- `exp`: Token expiration timestamp (configurable via `JWT_EXPIRES_IN`, default `7d`)

> **Security Note**: Plaintext passwords and `passwordHash` are never included in the JWT payload or returned by any API endpoint.

---

## Endpoints Summary

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register a new user account |
| `POST` | `/api/auth/login` | No | Authenticate user and obtain access token |
| `GET` | `/api/auth/me` | Yes (Bearer Token) | Retrieve authenticated user's profile |
| `POST` | `/api/auth/logout` | No / Optional | Acknowledge client-side logout |

---

## Endpoints

### 1. Register User

`POST /api/auth/register`

Creates a new user account, stores the bcrypt-hashed password in TiDB Cloud via Prisma, and returns an access token with safe user details.

#### Rate Limit
- **Limit**: 10 requests per 15 minutes per IP address.
- **Header**: Returns `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

#### Request Body
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```

#### Validation Rules
- `name`: String, trimmed, length between 2 and 50 characters.
- `email`: String, trimmed and converted to lowercase, valid RFC 5322 email format, maximum 254 characters.
- `password`: String, length between 8 and 72 characters, containing at least one uppercase letter (`A-Z`), at least one lowercase letter (`a-z`), and at least one number (`0-9`).

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cuid_example_id",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-11-19T03:30:00.000Z",
    "updatedAt": "2026-11-19T03:30:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request** — Validation failure:
  ```json
  {
    "success": false,
    "message": "Password must contain at least one uppercase letter.",
    "error": "Password must contain at least one uppercase letter."
  }
  ```
- **409 Conflict** — Email already registered:
  ```json
  {
    "success": false,
    "message": "An account with this email address already exists.",
    "error": "An account with this email address already exists."
  }
  ```
- **429 Too Many Requests** — Rate limit exceeded:
  ```json
  {
    "success": false,
    "message": "Too many registration attempts. Please try again after 15 minutes.",
    "error": "Too many registration attempts. Please try again after 15 minutes.",
    "retryAfter": 890
  }
  ```

---

### 2. Login User

`POST /api/auth/login`

Authenticates a user with email and password and returns a newly signed JWT access token.

#### Rate Limit
- **Limit**: 20 requests per 15 minutes per IP address.

#### Request Body
```json
{
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cuid_example_id",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-11-19T03:30:00.000Z",
    "updatedAt": "2026-11-19T03:30:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request** — Missing or invalid format:
  ```json
  {
    "success": false,
    "message": "Please provide a valid email address.",
    "error": "Please provide a valid email address."
  }
  ```
- **401 Unauthorized** — Invalid credentials (generic error to prevent user enumeration):
  ```json
  {
    "success": false,
    "message": "Invalid email or password.",
    "error": "Invalid email or password."
  }
  ```
- **429 Too Many Requests** — Rate limit exceeded:
  ```json
  {
    "success": false,
    "message": "Too many login attempts. Please try again after 15 minutes.",
    "error": "Too many login attempts. Please try again after 15 minutes.",
    "retryAfter": 720
  }
  ```

---

### 3. Get Current User Profile

`GET /api/auth/me`

Retrieves the currently authenticated user's safe profile. Requires a valid JWT Bearer token in the `Authorization` header.

#### Request Headers
```http
Authorization: Bearer <jwt_access_token>
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "user": {
    "id": "cuid_example_id",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-11-19T03:30:00.000Z",
    "updatedAt": "2026-11-19T03:30:00.000Z"
  }
}
```

#### Error Responses
- **401 Unauthorized** — Missing token:
  ```json
  {
    "success": false,
    "message": "Authentication token is required.",
    "error": "Authentication token is required."
  }
  ```
- **401 Unauthorized** — Expired token:
  ```json
  {
    "success": false,
    "message": "Token has expired.",
    "error": "Token has expired."
  }
  ```
- **401 Unauthorized** — Invalid token signature:
  ```json
  {
    "success": false,
    "message": "Invalid authentication token.",
    "error": "Invalid authentication token."
  }
  ```
- **401 Unauthorized** — Account deleted or not found:
  ```json
  {
    "success": false,
    "message": "User account no longer exists.",
    "error": "User account no longer exists."
  }
  ```

---

### 4. Logout

`POST /api/auth/logout`

Acknowledges logout.

#### Stateless Session Strategy
CoCode Backend V2 uses stateless JWT access tokens.
- **Client Responsibility**: The client must discard the token from local storage / cookies upon logout.
- **Server Behavior**: Immediate server-side revocation is not provided in this stateless phase. If token revocation across all devices is required in future phases, a token blocklist (e.g. Redis or database-backed active session table) can be added.

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Logged out successfully. Note that tokens are stateless; please clear the token from client storage."
}
```
