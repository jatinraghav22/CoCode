# CoCode — Production Deployment Guide

## 1. Production Architecture Overview

CoCode is deployed on modern cloud infrastructure utilizing free-tier platforms:

```
┌─────────────────────────┐         HTTPS / WSS          ┌───────────────────────────────────┐
│         Client          │ ───────────────────────────> │            Backend V2             │
│   (React 19 + Vite 8)   │                              │     (Node.js 20 + Express 5)      │
│   Vercel Deployment     │ <─────────────────────────── │         Render Web Service        │
└─────────────────────────┘      Socket.IO + REST        └───────────────────────────────────┘
                                                                   │                   │
                                                    Prisma / TLS   │                   │ HTTPS
                                                                   ▼                   ▼
                                                     ┌───────────────────┐    ┌─────────────────┐
                                                     │    TiDB Cloud     │    │    Judge0 CE    │
                                                     │ (Serverless MySQL)│    │ (Code Execution)│
                                                     └───────────────────┘    └─────────────────┘
```

### Production Service Inventory
- **Frontend URL**: [https://getcocode.vercel.app](https://getcocode.vercel.app)
- **Backend V2 URL**: [https://cocode-backend-v2.onrender.com](https://cocode-backend-v2.onrender.com)
- **Backend Health Probe**: [https://cocode-backend-v2.onrender.com/api/health](https://cocode-backend-v2.onrender.com/api/health)
- **Backend Readiness Probe**: [https://cocode-backend-v2.onrender.com/api/ready](https://cocode-backend-v2.onrender.com/api/ready)
- **Database**: TiDB Cloud Serverless (MySQL 8 compatible, AWS us-east-1)
- **Compiler**: Judge0 Community Edition (CE) remote sandbox

---

## 2. Frontend Deployment (Vercel)

### Project Configuration
- **Root Directory**: `client`
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node.js Version**: 20.x

### Environment Variables on Vercel
| Variable | Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://cocode-backend-v2.onrender.com` | Base URL for Backend V2 REST and Socket.IO endpoints |

### Deploying Updates
```bash
# Push to main branch triggers automated Vercel CI/CD pipeline
git push origin main
```

---

## 3. Backend Deployment (Render Web Service)

### Service Configuration
- **Repository**: `https://github.com/jatinraghav22/CoCode`
- **Root Directory**: `server-v2`
- **Environment**: Node
- **Region**: Oregon (US West) or Ohio (US East)
- **Branch**: `main`
- **Build Command**: `npm install && npx prisma generate --schema=prisma/schema.prisma`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

### Environment Variables on Render
| Variable | Recommended Production Setting |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render dynamically assigns) |
| `CLIENT_ORIGIN` | `https://getcocode.vercel.app,http://localhost:5173` |
| `TRUST_PROXY` | `1` (Render acts as single reverse proxy) |
| `DATABASE_URL` | `mysql://<user>:<password>@<host>:4000/cocode?sslaccept=strict` |
| `JWT_SECRET` | *(64-character high-entropy secret string)* |
| `JWT_EXPIRES_IN` | `7d` |
| `JUDGE0_BASE_URL` | `https://ce.judge0.com` |

---

## 4. Cold-Start & Free-Tier Operational Behavior

1. **Render Free-Tier Spin-Down**:
   - Render spins down inactive web services after 15 minutes of inactivity.
   - The first request after sleep initiates a cold start (typically 30–50 seconds).
   - **Keepalive Mitigation**: Set up a free external ping monitor (e.g. UptimeRobot, Cron-Job.org, or Better Stack) hitting `GET https://cocode-backend-v2.onrender.com/api/health` every 10–14 minutes.

2. **TiDB Cloud Serverless Auto-Resume**:
   - TiDB Cloud Serverless automatically scales to zero when idle and warms up in ~1–3 seconds upon incoming query.
   - `/api/ready` validates database connectivity using `SELECT 1` with a 4-second timeout.
