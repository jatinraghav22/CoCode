# CoCode — Production Monitoring and Logging Guide

## 1. Overview & Monitoring Strategy

This guide outlines the production logging, liveness, and readiness monitoring architecture for CoCode Backend V2. It is designed to operate effectively on free-tier cloud infrastructure (Render + TiDB Cloud + Vercel) without requiring paid monitoring agents.

---

## 2. Health & Readiness Endpoints

CoCode provides two distinct probe endpoints conforming to cloud-native monitoring standards:

### 2.1 Liveness Probe (`GET /api/health`)
- **Purpose**: Fast check confirming that the Node.js event loop is operational and the HTTP server is serving traffic.
- **Dependency Checks**: None (returns immediately).
- **Ideal for**: Load balancer ping checks, uptime monitors, and Render health checks.
- **Example Response** (`HTTP 200`):
  ```json
  {
    "success": true,
    "service": "cocode-backend-v2",
    "status": "healthy",
    "timestamp": "2026-11-23T13:48:57.561Z",
    "uptime": 3600
  }
  ```

### 2.2 Readiness Probe (`GET /api/ready`)
- **Purpose**: Deep dependency check verifying that the TiDB Cloud database connection is established and healthy.
- **Mechanism**: Executes `SELECT 1` through Prisma with a strict 4-second timeout.
- **Response Codes**:
  - `HTTP 200`: Database is operational and ready to serve queries.
  - `HTTP 503`: Database connection failed or timed out.
- **Example Ready Response** (`HTTP 200`):
  ```json
  {
    "success": true,
    "service": "cocode-backend-v2",
    "status": "ready",
    "checks": {
      "database": "healthy"
    },
    "timestamp": "2026-11-23T13:49:00.772Z"
  }
  ```
- **Example Not Ready Response** (`HTTP 503`):
  ```json
  {
    "success": false,
    "service": "cocode-backend-v2",
    "status": "not_ready",
    "checks": {
      "database": "unreachable"
    },
    "timestamp": "2026-11-23T13:49:00.772Z"
  }
  ```

---

## 3. Structured Production Logging

Backend V2 incorporates a centralized, structured logging utility in `src/utils/logger.js`.

### Log Categories
- `[HTTP]`: Incoming request logging with method, path, status, and duration.
- `[AUTH]`: Registration and login events, authentication failures.
- `[COMPILER]`: Judge0 submission, polling, and timeout errors.
- `[SOCKET]`: Socket.IO connections, room joins, Yjs synchronizations, and disconnections.
- `[DB]`: Prisma query errors, reconnection attempts, and save failures.
- `[SHUTDOWN]`: Graceful shutdown sequence milestones and pending document flushes.

### Automatic Log Sanitization
Every log message automatically sanitizes sensitive fields before output:
- Bearer tokens are redacted to `Bearer [REDACTED]`.
- Passwords and `passwordHash` are replaced with `[REDACTED]`.
- Database credentials and secrets are never printed.

---

## 4. Free-Tier Uptime & Alerting Setup

To keep the Render free-tier service awake and receive notifications on failures:

1. **UptimeRobot / Cron-Job.org**:
   - Create a free HTTP monitor targeting: `https://cocode-backend-v2.onrender.com/api/health`
   - Set monitoring interval to every **10 minutes**.
   - This prevents Render's 15-minute idle spin-down while verifying service availability.

2. **Database Health Alert**:
   - Create a secondary HTTP monitor targeting: `https://cocode-backend-v2.onrender.com/api/ready`
   - Set check interval to every **15 minutes**.
   - Configure email or webhook alerts if HTTP status is not 200.
