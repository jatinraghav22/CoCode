# CoCode Backend V2 — Profile & Account Management API Documentation

## Overview
This document specifies the Phase 4 Profile & Account Management API for CoCode Backend V2.
The profile management system is built using:
- **Framework**: Express.js (Node.js CommonJS)
- **Database / ORM**: TiDB Cloud (MySQL compatible) with Prisma ORM 6.19.3
- **Authentication**: JWT verification via HTTP Bearer token
- **Password Security**: `bcryptjs` (salt rounds: 10) with current password verification and password reuse prevention
- **Rate Limiting**: In-memory sliding window rate limiting on sensitive password-change operations

---

## Authentication Mechanism
All endpoints in this specification are protected and require a valid JWT access token passed in the HTTP `Authorization` header:

```http
Authorization: Bearer <jwt_access_token>
```

### Authentication Rules
- Requests without a token receive `401 Unauthorized`.
- Requests with an invalid, expired, or tampered token receive `401 Unauthorized`.
- If the token is valid but the corresponding user account no longer exists in the database, the API returns `404 Not Found`.
- User identity is always derived from the verified token (`req.userId`); client-supplied identifiers (`id`, `userId`) in the request body or query are strictly ignored or rejected to prevent privilege escalation and IDOR attacks.

---

## Endpoints Summary

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/users/me` | Yes (Bearer Token) | Retrieve authenticated user's profile |
| `PATCH` | `/api/users/me` | Yes (Bearer Token) | Update authenticated user's profile (name) |
| `PATCH` | `/api/users/me/password` | Yes (Bearer Token) | Change authenticated user's password |

---

## Endpoints

### 1. Get Authenticated User Profile

`GET /api/users/me`

Retrieves the authenticated user's information from TiDB Cloud using Prisma. Returns only safe user profile fields. Never returns sensitive internal fields, password hashes, or secrets.

#### Headers
```http
Authorization: Bearer <jwt_token>
```

#### Request Body
None.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "user": {
    "id": "cm47a1b2c000108l0xxxxxx",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
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
- **401 Unauthorized** — Invalid/tampered token:
  ```json
  {
    "success": false,
    "message": "Invalid authentication token.",
    "error": "Invalid authentication token."
  }
  ```
- **404 Not Found** — User no longer exists in database:
  ```json
  {
    "success": false,
    "message": "User not found.",
    "error": "User not found."
  }
  ```

---

### 2. Update Authenticated User Profile

`PATCH /api/users/me`

Updates permitted profile fields for the authenticated user. Currently, only the user's `name` can be updated. Rejects unexpected fields, attempts to modify immutable fields (such as `email` or `id`), and invalid inputs.

#### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body Example
```json
{
  "name": "Ada King Lovelace"
}
```

#### Validation Rules
- `name`: Required string, trimmed, length between 2 and 50 characters.
- `email`: Not permitted. Attempts to update email return `400 Bad Request`.
- `password`, `passwordHash`: Not permitted through this endpoint. Must use `PATCH /api/users/me/password`.
- `id`, `userId`: Not permitted in request body.
- Unexpected fields: Any additional field outside of `name` is rejected with `400 Bad Request`.
- Empty body (`{}`): Rejected with `400 Bad Request`.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "user": {
    "id": "cm47a1b2c000108l0xxxxxx",
    "name": "Ada King Lovelace",
    "email": "ada@example.com",
    "createdAt": "2026-11-19T03:30:00.000Z",
    "updatedAt": "2026-11-19T04:15:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request** — Invalid name length:
  ```json
  {
    "success": false,
    "message": "Name must be at least 2 characters.",
    "error": "Name must be at least 2 characters."
  }
  ```
- **400 Bad Request** — Attempt to modify email:
  ```json
  {
    "success": false,
    "message": "Email cannot be updated through this endpoint.",
    "error": "Email cannot be updated through this endpoint."
  }
  ```
- **400 Bad Request** — Unexpected field:
  ```json
  {
    "success": false,
    "message": "Unexpected field: 'role'. Only permitted fields can be updated.",
    "error": "Unexpected field: 'role'. Only permitted fields can be updated."
  }
  ```
- **401 Unauthorized** — Missing or invalid token.
- **404 Not Found** — User account not found.

---

### 3. Change Authenticated User Password

`PATCH /api/users/me/password`

Securely updates the authenticated user's password. Verifies the current password using `bcryptjs`, enforces password strength policies on the new password, prevents reusing the current password, and stores the new bcrypt hash with salt round factor 10.

#### Rate Limit
- **Limit**: 15 requests per 15 minutes per IP address (skipped in test environments).

#### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body Example
```json
{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "BrandNewPassword456!"
}
```

#### Validation Rules
- `currentPassword`: Required string.
- `newPassword`: Required string with the following strength requirements:
  - Length between 8 and 72 characters.
  - At least one uppercase letter (`A-Z`).
  - At least one lowercase letter (`a-z`).
  - At least one numeric digit (`0-9`).
- `newPassword` cannot be identical to `currentPassword`.
- Reusing the existing password (matching stored hash) is rejected.
- Unexpected fields: Any extra fields in request body return `400 Bad Request`.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Password changed successfully."
}
```

#### Error Responses
- **400 Bad Request** — Incorrect current password:
  ```json
  {
    "success": false,
    "message": "Incorrect current password.",
    "error": "Incorrect current password."
  }
  ```
- **400 Bad Request** — Weak new password:
  ```json
  {
    "success": false,
    "message": "Password must contain at least one uppercase letter.",
    "error": "Password must contain at least one uppercase letter."
  }
  ```
- **400 Bad Request** — Reusing current password:
  ```json
  {
    "success": false,
    "message": "New password cannot be the same as the current password.",
    "error": "New password cannot be the same as the current password."
  }
  ```
- **400 Bad Request** — Missing required field:
  ```json
  {
    "success": false,
    "message": "Current password is required.",
    "error": "Current password is required."
  }
  ```
- **401 Unauthorized** — Missing or invalid token.
- **404 Not Found** — User account not found.
- **429 Too Many Requests** — Rate limit exceeded:
  ```json
  {
    "success": false,
    "message": "Too many password change attempts. Please try again after 15 minutes.",
    "error": "Too many password change attempts. Please try again after 15 minutes."
  }
  ```

---

## Security Guarantees
1. **Never Expose Sensitive Data**: Passwords, `passwordHash`, and JWT signing secrets are never returned in response payloads or included in logs.
2. **Strict Identity Binding**: Profile updates and password changes are bound to `req.userId` decoded from the cryptographically verified JWT token. Clients cannot modify or target another user's account.
3. **Mass Assignment Protection**: Request bodies are strictly validated against allowlists. Unexpected fields trigger rejection (`400 Bad Request`) rather than being ignored or written to the database.
4. **Strong Cryptography**: Passwords are saved with `bcryptjs` at work factor 10. Timing-safe comparisons are utilized.
5. **No Password Reuse**: Users cannot set their new password to their current password.
