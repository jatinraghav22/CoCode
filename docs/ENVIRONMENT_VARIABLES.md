# CoCode — Environment Variables Specification

This document details all configuration options for CoCode Frontend and Backend V2.

> [!CAUTION]
> **Secret Protection**:
> Never commit `.env` files or hardcode secrets into source repositories. In production, configure secrets through the platform dashboards (Render and Vercel).

---

## 1. Frontend Configuration (`client/.env`)

| Variable | Required in Prod | Default (Local) | Description |
|---|---|---|---|
| `VITE_API_URL` | Recommended | `http://localhost:5000` | Backend V2 API and Socket.IO origin URL |

If `VITE_API_URL` is omitted in production, `client/src/config/api.js` automatically detects non-localhost hostnames and safely defaults to `https://cocode-backend-v2.onrender.com`.

---

## 2. Backend V2 Configuration (`server-v2/.env`)

### Server & Networking
| Variable | Required in Prod | Default (Local) | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Local port number (Render assigns dynamically) |
| `NODE_ENV` | Yes | `development` | Runtime mode: `development`, `production`, or `test` |
| `CLIENT_ORIGIN` | Yes | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `TRUST_PROXY` | Recommended | `false` | Reverse proxy trust setting (`1`, `true`, or subnet) |

### Database (TiDB Cloud / MySQL)
| Variable | Required in Prod | Example Format | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `mysql://user:pass@host:4000/db?sslaccept=strict` | Prisma MySQL database connection string with TLS |

### Authentication & Tokens
| Variable | Required in Prod | Default (Dev only) | Constraints |
|---|---|---|---|
| `JWT_SECRET` | **YES** | `cocode_dev_jwt_secret...` | Must be at least 32 characters; throws error if missing in prod |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration duration (e.g. `7d`, `24h`) |
| `JWT_ISSUER` | No | `cocode-backend-v2` | Expected issuer claim (`iss`) |
| `JWT_AUDIENCE` | No | `cocode-client` | Expected audience claim (`aud`) |

### Remote Compiler (Judge0 CE)
| Variable | Required in Prod | Default | Description |
|---|---|---|---|
| `JUDGE0_BASE_URL` | No | `https://ce.judge0.com` | Base URL of Judge0 execution service |
| `JUDGE0_API_KEY` | No | `null` (Free tier) | Optional API key for RapidAPI / Enterprise Judge0 |
| `JUDGE0_TIMEOUT_MS` | No | `10000` | Single HTTP request timeout in ms |
| `JUDGE0_POLL_INTERVAL_MS`| No | `750` | Polling interval between status checks in ms |
| `JUDGE0_MAX_POLL_ATTEMPTS`| No | `15` | Maximum number of poll attempts |
| `JUDGE0_TOTAL_TIMEOUT_MS`| No | `15000` | Hard total deadline for submission and polling |
| `JUDGE0_USE_BASE64` | No | `true` | Base64 encode source code and stdio |
