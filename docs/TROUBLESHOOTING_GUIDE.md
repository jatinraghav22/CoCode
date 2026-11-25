# CoCode — Production Troubleshooting Guide

## 1. Quick Diagnostic Checklist

When investigating an issue, verify the following in sequence:

1. **Check Backend Liveness**:
   ```bash
   curl -i https://cocode-backend-v2.onrender.com/api/health
   ```
   Should return `HTTP 200` with `"status": "healthy"`.

2. **Check Database Connectivity**:
   ```bash
   curl -i https://cocode-backend-v2.onrender.com/api/ready
   ```
   Should return `HTTP 200` with `"database": "healthy"`. If it returns `HTTP 503`, check TiDB Cloud cluster state and credentials.

3. **Check Frontend Deployment**:
   Open [https://getcocode.vercel.app](https://getcocode.vercel.app) in your browser and check Developer Tools Console (`F12`) for errors.

---

## 2. Common Issues & Solutions

### A. Render Cold Starts (Initial 30–50s delay)
- **Symptom**: First API request takes ~45 seconds, frontend shows loading spinner.
- **Cause**: Render free-tier services spin down after 15 minutes of inactivity.
- **Solution**: Wait for spin-up. To prevent spin-downs, configure an external ping monitor (e.g. UptimeRobot) hitting `/api/health` every 10–14 minutes.

### B. CORS Policy Errors
- **Symptom**: Browser console shows `CORS policy: No 'Access-Control-Allow-Origin' header is present`.
- **Cause**: The incoming request origin is not listed in Render's `CLIENT_ORIGIN` environment variable.
- **Solution**: In Render Dashboard, ensure `CLIENT_ORIGIN` contains `https://getcocode.vercel.app`.

### C. Judge0 Rate Limiting (`HTTP 429` / `HTTP 503`)
- **Symptom**: Code execution returns `"Execution service busy"` or `"Too many requests"`.
- **Cause**: Public Judge0 CE Community Edition has reached its concurrency cap, or the client exceeded 20 executions/minute.
- **Solution**: Wait 30 seconds and retry. In production with heavy compiler traffic, provision a private Judge0 instance or configure `JUDGE0_API_KEY`.

### D. Real-Time Collaboration Not Syncing
- **Symptom**: Changes in Monaco editor do not reflect on peer screens.
- **Cause**: WebSocket connection failed or room join rejected.
- **Diagnostic**:
  - Check browser console for Socket.IO connection status.
  - Verify JWT is valid and not expired.
  - Confirm the user is enrolled in the room (`GET /api/rooms/:code`).

### E. Database Connection Timeouts
- **Symptom**: `/api/ready` returns `HTTP 503` with `"database": "unreachable"`.
- **Cause**: TiDB Cloud serverless cluster paused or network connection dropped.
- **Solution**: TiDB Cloud serverless cluster auto-resumes upon traffic. Check TiDB Cloud Console to ensure cluster status is "Available" and IP access rules allow connections.
