# CoCode — Database Backup and Disaster Recovery Guide

## 1. Executive Summary & Architecture Overview

CoCode utilizes a high-availability **TiDB Cloud Serverless** database cluster (MySQL 8.0 wire-compatible distributed SQL database). All production application data is managed via **Prisma ORM** within `server-v2`.

> [!NOTE]
> This guide is an operational procedure and disaster recovery runbook. In strict compliance with project safety rules, no destructive operations, manual database dumps, or live restores were executed against the active production TiDB Cloud database during Phase 10 verification. All existing records and schemas remain strictly preserved.

### Core Data Models
| Table Name | Description | Sensitivity / Criticality |
|---|---|---|
| `users` | User accounts, profiles, bcrypt password hashes | **Critical** (Contains credentials & identity) |
| `projects` | User coding projects and workspaces | **Critical** (User-generated source code repositories) |
| `project_files` | Project source files, file hierarchy, content | **Critical** (User source code up to 1MB/file) |
| `collaboration_rooms` | Multi-user collaborative rooms and 6-char codes | **High** (Active and persistent collaborative sessions) |
| `room_participants` | Room membership records and role tracking | **Medium** (Access authorization records) |
| `room_documents` | Live room files, plain text, and binary Yjs CRDT states | **High** (Real-time collaboration state and recovery) |
| `coding_activities` | Telemetry, compilation runs, metrics | **Low/Medium** (User activity history & dashboard analytics) |

---

## 2. TiDB Cloud Serverless Free-Tier Backup Architecture

TiDB Cloud Serverless provides built-in disaster recovery safeguards alongside free manual export mechanisms:

1. **Automated Continuous Snapshots**:
   - TiDB Cloud Serverless maintains multi-replica distributed storage across Availability Zones with continuous Raft consensus.
   - Point-in-Time Recovery (PITR) metadata is maintained by the cloud platform for cluster restoration.

2. **Logical Database Backups (`mysqldump` / Dumpling)**:
   - Because TiDB Cloud is fully MySQL wire-compatible, standard client utilities (`mysqldump`, MySQL Shell, or TiDB Dumpling) can perform full logical database exports over TLS.
   - Zero-cost: Logical dumps can be scheduled locally or in CI/CD without requiring paid cloud addons.

> [!IMPORTANT]
> **Strict Safety Rules**:
> - Never execute `prisma db push`, `prisma migrate reset`, or destructive migrations on production.
> - Never execute restore commands against the production cluster without explicit administrative authorization.
> - Always perform test restores on a separate staging or local instance.

---

## 3. Production Backup Procedures

### Method 1: Logical TLS Export via `mysqldump` (Recommended Free Strategy)

TiDB Cloud requires TLS encryption and MySQL 8 compatibility flags. Run the following command from an administrative shell with your database credentials loaded into environment variables:

```bash
# Set credentials safely in the current session (never write secrets to disk)
# Replace placeholders with your actual connection parameters:
DB_HOST="gateway01.us-east-1.prod.aws.tidbcloud.com"
DB_PORT="4000"
DB_USER="<user>.root"
DB_NAME="cocode"
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="cocode_backup_${BACKUP_DATE}.sql.gz"

# Perform compressed streaming logical dump
mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password \
  --ssl-mode=REQUIRED \
  --single-transaction \
  --skip-lock-tables \
  --routines \
  --triggers \
  --databases "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "Backup completed: ${BACKUP_FILE}"
```

**Key Parameters Explained**:
- `--ssl-mode=REQUIRED`: Enforces TLS encryption in transit across the public internet.
- `--single-transaction`: Consistent snapshot without locking tables or interrupting active users.
- `--skip-lock-tables`: Necessary for TiDB distributed transaction architecture.
- `gzip`: Compresses the SQL dump by 85–90% to minimize storage overhead.

---

### Method 2: Schema-Only Backup

To back up table structures, constraints, and indexes without data:

```bash
mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password \
  --ssl-mode=REQUIRED \
  --no-data \
  --databases "${DB_NAME}" > "cocode_schema_${BACKUP_DATE}.sql"
```

---

### Method 3: Automated Node.js Safe Data Extraction

For automated environment pipelines where native MySQL client tools are not pre-installed, a read-only script using Prisma can export table data into JSON archives:

```javascript
// scripts/export-backup.js (Read-only export pattern)
const fs = require("node:fs");
const path = require("node:path");
const { prisma } = require("../server-v2/src/config/prisma");

async function exportTables() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, `../backups/backup-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const tables = [
    { name: "users", fetch: () => prisma.user.findMany() },
    { name: "projects", fetch: () => prisma.project.findMany() },
    { name: "project_files", fetch: () => prisma.projectFile.findMany() },
    { name: "collaboration_rooms", fetch: () => prisma.collaborationRoom.findMany() },
    { name: "room_participants", fetch: () => prisma.roomParticipant.findMany() },
    { name: "room_documents", fetch: () => prisma.roomDocument.findMany() },
    { name: "coding_activities", fetch: () => prisma.codingActivity.findMany() },
  ];

  for (const { name, fetch } of tables) {
    console.log(`Exporting table: ${name}...`);
    const records = await fetch();
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify(records, null, 2),
      "utf8"
    );
    console.log(`Saved ${records.length} records to ${name}.json`);
  }

  await prisma.$disconnect();
  console.log("Read-only export complete.");
}

exportTables().catch((err) => {
  console.error("Export failed:", err.message);
  process.exit(1);
});
```

---

## 4. Backup Verification & Integrity Check

A backup is only as good as its tested ability to restore. Perform integrity verification on every backup artifact:

1. **Verify Archive Integrity**:
   ```bash
   # Test gzip integrity without decompressing
   gzip -t "cocode_backup_${BACKUP_DATE}.sql.gz"
   echo "Gzip checksum: OK"
   ```

2. **Verify SQL Structure**:
   ```bash
   # Inspect header and schema presence
   zcat "cocode_backup_${BACKUP_DATE}.sql.gz" | head -n 30
   zcat "cocode_backup_${BACKUP_DATE}.sql.gz" | grep -E "CREATE TABLE"
   ```
   Confirm all 7 required tables are present in the create table statements:
   - `users`
   - `collaboration_rooms`
   - `room_participants`
   - `room_documents`
   - `projects`
   - `project_files`
   - `coding_activities`

3. **Compute SHA-256 Checksum**:
   ```bash
   sha256sum "cocode_backup_${BACKUP_DATE}.sql.gz" > "cocode_backup_${BACKUP_DATE}.sha256"
   ```

---

## 5. Disaster Recovery & Restoration Procedure

> [!CAUTION]
> **RESTORE PROTOCOL**:
> Never execute a restore directly onto the active production database. Always restore into an isolated recovery database or staging cluster to inspect data validity first.

### Step-by-Step Restoration Plan

1. **Step 1: Declare Incident & Lock Writes**
   - If the production database experiences corruption or data loss, set the backend into maintenance mode or stop the Render service to prevent contradictory concurrent writes.

2. **Step 2: Prepare Target Database**
   - Provision a fresh TiDB Cloud Serverless database or temporary staging branch (e.g. `cocode_recovery`).

3. **Step 3: Execute Restoration**
   ```bash
   # Decompress and restore into target recovery database
   gunzip < "cocode_backup_<TIMESTAMP>.sql.gz" | mysql \
     --host="${RECOVERY_DB_HOST}" \
     --port="${RECOVERY_DB_PORT}" \
     --user="${RECOVERY_DB_USER}" \
     --password \
     --ssl-mode=REQUIRED \
     "${RECOVERY_DB_NAME}"
   ```

4. **Step 4: Run Data Verification Queries**
   - Verify table counts match the expected state:
   ```sql
   SELECT 'users' AS tbl, COUNT(*) FROM users
   UNION ALL
   SELECT 'projects', COUNT(*) FROM projects
   UNION ALL
   SELECT 'project_files', COUNT(*) FROM project_files
   UNION ALL
   SELECT 'collaboration_rooms', COUNT(*) FROM collaboration_rooms
   UNION ALL
   SELECT 'room_documents', COUNT(*) FROM room_documents;
   ```

5. **Step 5: Point Backend V2 to Restored Database**
   - Update `DATABASE_URL` in the Render Environment Dashboard.
   - Restart the Render service.
   - Inspect `/api/ready` to verify Prisma establishes connection and reports `"database": "healthy"`.
   - Validate login, project listing, and collaboration room rehydration.

---

## 6. High Availability & Data Loss Prevention (DLP)

CoCode implements architectural mechanisms in `server-v2` to prevent data loss even during sudden service restarts:

1. **In-Flight Document Protection (`room.store.js`)**:
   - Collaboration updates are debounced and sequenced per document.
   - Serialized Yjs binary CRDT states are saved alongside plain text into `room_documents`.
   - Versions and `isDirty` state ensure out-of-order writes never overwrite newer content.

2. **Graceful Shutdown Flush (`server.js`)**:
   - On `SIGTERM` / `SIGINT` signals, Socket.IO connections and writes are closed immediately.
   - The store flushes all dirty room documents to TiDB Cloud with a 20-second timeout.
   - Prisma disconnect is skipped if in-flight writes are pending, preventing connection drops during active saves.

3. **Prisma Connection Resilience**:
   - Prisma maintains an internal connection pool with automatic query retries on transient connection drops.
   - Failed document saves retry with exponential backoff up to 3 times before failing safely.

4. **Health & Readiness Monitoring**:
   - `/api/health`: Instant liveness probe.
   - `/api/ready`: Real-time connectivity check executing `SELECT 1` with a 4-second deadline against TiDB Cloud.
