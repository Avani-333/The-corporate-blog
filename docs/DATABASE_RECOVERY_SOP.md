# Database Recovery Standard Operating Procedure (SOP)

## Document Information
- **Last Updated**: March 2026
- **Version**: 1.0
- **Audience**: DevOps, Database Administrators, Engineering Team
- **Emergency Contact**: Database Admin On-Call (See On-Call Schedule)

---

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Planning & Prerequisites](#planning--prerequisites)
3. [Assessment & Diagnosis](#assessment--diagnosis)
4. [Recovery Procedures](#recovery-procedures)
5. [Verification Procedures](#verification-procedures)
6. [Post-Recovery Steps](#post-recovery-steps)
7. [Rollback Procedures](#rollback-procedures)
8. [Escalation & Communication](#escalation--communication)

---

## Quick Reference

### Emergency Response Checklist
```
⚠️ CRITICAL INCIDENT
├─ [ ] Page on-call DBA immediately
├─ [ ] Gather error logs and metrics
├─ [ ] Communicate with #incidents Slack channel
├─ [ ] Begin recovery procedure
├─ [ ] Monitor database during recovery
├─ [ ] Verify data integrity
├─ [ ] Document incident
└─ [ ] Post-incident review

RECOVERY CONTACT:
- Primary DBA: [Phone/Slack]
- Backup Contact: [Phone/Slack]
- Incident Commander: [Phone/Slack]
```

### Recovery Time Estimates

| Scenario | RTO | RPO | Method |
|----------|-----|-----|--------|
| Connection Timeout | 15 min | 1 hour | Connection Pool Reset |
| Corrupted Indexes | 30 min | 0 min | Index Rebuild |
| Data Corruption | 2 hours | 1 hour | Point-in-Time Recovery |
| Catastrophic Failure | 4 hours | 4 hours | Full Restore from Backup |
| User Error (Data Deletion) | 1 hour | 5 min | PITR to 5 min ago |

---

## Planning & Prerequisites

### Required Access & Credentials

Before recovery begins, ensure you have:

```
✅ Neon Console access
   URL: https://console.neon.tech
   Credentials: Team credentials in 1Password

✅ PostgreSQL client tools installed
   - psql
   - pg_dump
   - pg_restore

✅ SSH access to servers
   - Jump host (if applicable)
   - Application servers
   - Backup storage

✅ AWS CLI configured
   - Credentials for S3 backup storage
   - Export: AWS_PROFILE=corporate-blog

✅ Backup files location
   - Local: ./backups/
   - Remote: s3://corporate-blog-backups/
   - Off-site: Glacier backup retention

✅ Monitoring & Logger Access
   - Sentry: https://sentry.io/projects/corporate-blog
   - DataDog: https://datadoghq.com
   - CloudWatch: AWS Console
```

### Environment Setup

```bash
# 1. Load environment configuration
export NODE_ENV=staging  # or production
source .env.local
source .env.${NODE_ENV}

# 2. Verify database connectivity
psql -d "$(echo $POSTGRES_URL_NON_POOLING)" -c "SELECT version();"

# 3. Export connection info for commands
export DB_URL=$POSTGRES_URL_NON_POOLING
export DB_POOL_URL=$POSTGRES_PRISMA_URL

# 4. Create recovery workspace
mkdir -p recovery-$(date +%s)
cd recovery-$(date +%s)
```

### Backup Inventory

Before starting recovery:

```bash
# List available backups
aws s3 ls s3://corporate-blog-backups/ --recursive

# Check local backups
ls -lh ./backups/backup-*.sql.gz

# Verify backup metadata
cat backup-manifest.json | jq '.backups[] | {filename, date, size, status}'
```

---

## Assessment & Diagnosis

### 1. Initial Incident Assessment

```bash
#!/bin/bash
# recovery-assessment.sh
# Run this first to gather diagnostic information

echo "========================================"
echo "DATABASE RECOVERY ASSESSMENT"
echo "========================================"
echo "Time: $(date -u)"

echo -e "\n[1] Database Connection Status"
psql -d $DB_URL -c "SELECT 'Connected ✓' AS status;" || echo "Connection Failed ✗"

echo -e "\n[2] Database Version & Info"
psql -d $DB_URL -c "SELECT version(), current_database();"

echo -e "\n[3] Database Size"
psql -d $DB_URL -c "
  SELECT pg_size_pretty(pg_database_size(current_database())) AS size;"

echo -e "\n[4] Table Count & Status"
psql -d $DB_URL -c "
  SELECT 
    COUNT(*) as total_tables,
    COUNT(CASE WHEN relpersistence = 'p' THEN 1 END) as regular_tables
  FROM pg_class WHERE relkind = 'r';"

echo -e "\n[5] Active Connections"
psql -d $DB_URL -c "
  SELECT usename, application_name, state, state_change 
  FROM pg_stat_activity 
  WHERE datname = current_database();"

echo -e "\n[6] Disk Space Available"
df -h / | tail -1

echo -e "\n[7] Recent Errors in Logs"
tail -50 /var/log/postgresql/postgresql.log | grep -i error || echo "No recent errors"

echo -e "\n[8] Last Successful Backup"
ls -lh ./backups/ | sort -k6,7 | tail -1
```

### 2. Identify Issue Type

```
ISSUE DIAGNOSIS TREE
│
├─ Connection Issues
│  ├─ Connection Timeout
│  ├─ Too Many Connections
│  └─ SSL/TLS Error
│
├─ Performance Issues
│  ├─ Slow Queries
│  ├─ Locked Tables
│  ├─ Full Disk
│  └─ High CPU/Memory
│
├─ Data Issues
│  ├─ Corrupted Indexes
│  ├─ Data Inconsistency
│  ├─ Accidental Deletion
│  └─ Bit Corruption
│
└─ Catastrophic Failure
   ├─ Server Down
   ├─ Corrupted WAL Files
   ├─ Storage Failure
   └─ Cascading Failure
```

### 3. Check Recent Activity

```bash
# Check Neon metrics
echo "Checking Neon console for recent issues..."
# -> https://console.neon.tech/app/projects/[PROJECT_ID]/monitoring

# Check application logs
tail -100 /var/log/app/error.log | grep -i database

# Check monitoring alerts
echo "Recent alerts:"
# -> DataDog / Sentry / CloudWatch

# Check transaction logs
psql -d $DB_URL -c "
  SELECT * FROM pg_stat_statements 
  ORDER BY max_time DESC LIMIT 10;"
```

---

## Recovery Procedures

### Procedure A: Connection Pool Reset

**Use when**: Connection timeouts, too many connections, pool exhaustion

```bash
#!/bin/bash
# recovery-pool-reset.sh

echo "🔄 Resetting Connection Pool..."

# 1. List active connections
echo "Active connections:"
psql -d $DB_URL -c "SELECT COUNT(*) FROM pg_stat_activity;"

# 2. Terminate idle connections (keep 5 min threshold)
echo "Terminating old idle connections..."
psql -d $DB_URL -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'idle' 
    AND state_change < now() - interval '5 minutes'
    AND pid != pg_backend_pid();"

# 3. Restart connection pool
echo "Restarting PgBouncer..."
docker-compose restart pgbouncer || systemctl restart pgbouncer

# 4. Verify
sleep 5
psql -d $DB_POOL_URL -c "SELECT 'Connected ✓' AS status;"

echo "✅ Connection Pool Reset Complete"
```

### Procedure B: Index Repair

**Use when**: Corrupted indexes, slow queries, index bloat

```bash
#!/bin/bash
# recovery-index-repair.sh

echo "🔧 Repairing Indexes..."

# 1. Identify invalid indexes
echo "Checking for invalid indexes..."
psql -d $DB_URL -c "
  SELECT 
    nspname, relname, indexname, idx_scan,
    CASE WHEN indisvalid THEN '✅' ELSE '❌' END AS valid
  FROM pg_index 
  JOIN pg_class ON pg_class.oid = pg_index.indexrelid 
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
  WHERE nspname = 'public';"

# 2. Rebuild invalid indexes
echo "Rebuilding invalid indexes..."
psql -d $DB_URL -c "
  SELECT 'REINDEX INDEX CONCURRENTLY ' || indexname || ';'
  FROM pg_indexes 
  WHERE schemaname = 'public'" | psql -d $DB_URL

# 3. Verify repair
echo "Verifying index integrity..."
npm run db:validate

echo "✅ Index Repair Complete"
```

### Procedure C: Point-in-Time Recovery (PITR)

**Use when**: Data deleted/corrupted < 7 days ago, need to recover to specific time

**Time to Recovery: 2-5 minutes**

```bash
#!/bin/bash
# recovery-pitr.sh
# Execute this in Neon Console directly

# NOTE: PITR is performed through Neon Console UI, not CLI
# This script documents the process

echo "📍 Point-in-Time Recovery Instructions"
echo "======================================="

echo "1. Open Neon Console"
echo "   URL: https://console.neon.tech/app/projects"

echo "2. Select your project"
echo "3. Click 'Branches' tab"
echo "4. Find your branch (e.g., 'staging' or 'main')"
echo "5. Click 'Restore' or 'Create from backup'"
echo "6. Enter target time (UTC): $(date -u '+%Y-%m-%d %H:%M:%S')"
echo "7. Confirm recovery"

echo -e "\n⏱️  Expected recovery time: 2-5 minutes"
echo "⚠️  Note: Original branch data will be replaced!"

read -p "Press ENTER after recovery completes..."

# 8. Verify recovery
echo "Verifying recovery..."
npm run db:health-check
npm run db:validate

echo "✅ PITR Complete"
```

### Procedure D: Full Database Restore from Backup

**Use when**: Catastrophic failure, multiple table corruption, complete data loss

**Time to Recovery: 5-60 minutes (depending on backup size)**

```bash
#!/bin/bash
# recovery-full-restore.sh

set -e  # Exit on any error

echo "🚨 Starting Full Database Restore"
echo "=================================="

# 1. PRE-FLIGHT CHECKS
echo "[1/8] Running pre-flight checks..."

# Check disk space (need 3x backup size)
BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Usage: $0 <backup-file.sql.gz>"
  echo "   Example: $0 ./backups/backup-staging-2024-03-15.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
BACKUP_SIZE_GB=$((BACKUP_SIZE / 1024 / 1024 / 1024))
REQUIRED_SPACE=$((BACKUP_SIZE_GB * 3))

AVAILABLE_SPACE=$(df . | awk 'NR==2 {print int($4/1024/1024)}')

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
  echo "❌ Insufficient disk space!"
  echo "   Required: ${REQUIRED_SPACE}GB"
  echo "   Available: ${AVAILABLE_SPACE}GB"
  exit 1
fi

echo "✅ Disk space: ${AVAILABLE_SPACE}GB available (need ${REQUIRED_SPACE}GB)"

# 2. BACKUP INTEGRITY CHECK
echo "[2/8] Checking backup integrity..."
gzip -t "$BACKUP_FILE"
echo "✅ Backup file is valid"

# 3. CONFIRMATION
echo "[3/8] Confirmation prompt..."
echo "⚠️  WARNING: This will OVERWRITE all data in the current database!"
echo "   Database: $DB_URL"
echo "   Backup: $BACKUP_FILE"
echo "   Size: ${BACKUP_SIZE_GB}GB"
read -p "Type 'CONFIRM' to proceed: " confirm
if [ "$confirm" != "CONFIRM" ]; then
  echo "❌ Recovery cancelled by user"
  exit 1
fi

# 4. STOP CONNECTIONS
echo "[4/8] Closing active connections..."
psql -d $DB_URL -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE pid != pg_backend_pid()
    AND datname = current_database();"

sleep 5

# 5. DROP & RECREATE DATABASE
echo "[5/8] Preparing database..."
DBNAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Drop all connections again
psql -d $DB_URL << EOF
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE pid != pg_backend_pid();
EOF

sleep 2

# Drop and recreate
psql -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);"
psql -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "✅ Database prepared"

# 6. RESTORE DATA
echo "[6/8] Restoring data from backup (this may take several minutes)..."
START_TIME=$(date +%s)

pg_restore --no-owner --clean --if-exists \
  --dbname=$DB_URL \
  "$BACKUP_FILE" || {
    echo "❌ Restore failed!"
    exit 1
  }

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
DURATION_MIN=$((DURATION / 60))

echo "✅ Data restored in ${DURATION_MIN} minutes"

# 7. VERIFICATION
echo "[7/8] Verifying restored data..."

# Check table count
TABLE_COUNT=$(psql -d $DB_URL -t -c "
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = 'public';")

echo "   Tables: $TABLE_COUNT"

# Check row counts
psql -d $DB_URL -c "
  SELECT 
    tablename,
    n_live_tup::text as rows
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC
  LIMIT 10;"

# Run validation
npm run db:validate

echo "✅ Data verified"

# 8. COMPLETION
echo "[8/8] Recovery complete!"
echo "========================================"
echo "📊 Summary:"
echo "   Duration: ${DURATION_MIN} minutes"
echo "   Tables: $TABLE_COUNT"
echo "   Status: ✅ SUCCESS"
echo "========================================"

# Post-recovery steps
echo -e "\n📋 Next Steps:"
echo "1. Run schema validation: npm run db:validate"
echo "2. Check application connectivity"
echo "3. Monitor error logs for issues"
echo "4. Verify data integrity with team"
echo "5. Document recovery in incident report"
```

### Procedure E: Selective Table Recovery

**Use when**: Only specific tables are corrupted, most data is intact

```bash
#!/bin/bash
# recovery-selective-table.sh

BACKUP_FILE=$1
TARGET_TABLE=$2
TEMP_DB="recovery_temp"

echo "🎯 Selective Table Recovery: $TARGET_TABLE"

# 1. Create temporary database
echo "Creating temporary recovery database..."
psql -d postgres -c "DROP DATABASE IF EXISTS \"$TEMP_DB\" WITH (FORCE);"
psql -d postgres -c "CREATE DATABASE \"$TEMP_DB\";"

# 2. Restore only target table
echo "Restoring table from backup..."
pg_restore --table=$TARGET_TABLE \
  --data-only \
  --dbname=postgresql://localhost/$TEMP_DB \
  "$BACKUP_FILE"

# 3. Verify data
echo "Verifying recovered data..."
psql -d $TEMP_DB -c "SELECT COUNT(*) as rows FROM \"$TARGET_TABLE\";"

# 4. Merge with production
read -p "Merge recovered data? (y/n): " merge
if [ "$merge" = "y" ]; then
  echo "Merging data..."
  # Backup current production data
  psql -d $DB_URL -c "
    CREATE TABLE \"${TARGET_TABLE}_backup\" AS 
    SELECT * FROM \"$TARGET_TABLE\";"
  
  # Replace with recovered data
  psql -d $DB_URL -c "DELETE FROM \"$TARGET_TABLE\";"
  pg_dump --table=$TARGET_TABLE $TEMP_DB | psql -d $DB_URL
  
  echo "✅ Merge complete"
  echo "Old data backed up in ${TARGET_TABLE}_backup"
fi

# 5. Cleanup
echo "Cleaning up temporary database..."
psql -d postgres -c "DROP DATABASE \"$TEMP_DB\" WITH (FORCE);"
```

---

## Verification Procedures

### Verify Connection Health

```bash
# Test connections
psql -d $DB_URL -c "SELECT 'Pooled ✓' AS status;"
psql -d $DB_POOL_URL -c "SELECT 'Direct ✓' AS status;"

# Check current connections
psql -d $DB_URL -c "
  SELECT count(*) as active_connections 
  FROM pg_stat_activity 
  WHERE datname = current_database();"
```

### Verify Data Integrity

```bash
#!/bin/bash
# recovery-verify-data.sh

echo "🔍 Data Integrity Verification"
echo "=============================="

# 1. Basic table counts
echo -e "\n[1] Table Row Counts"
psql -d $DB_URL -c "
  SELECT 
    schemaname, tablename, n_live_tup as rows
  FROM pg_stat_user_tables
  ORDER BY schemaname, tablename;"

# 2. Foreign key integrity
echo -e "\n[2] Foreign Key Checks"
psql -d $DB_URL -c "
  SELECT 
    constraint_name,
    table_name,
    (SELECT count(*) FROM information_schema.check_constraints) as total
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
  LIMIT 10;"

# 3. Check for orphaned records
echo -e "\n[3] Checking for Orphaned Records"
psql -d $DB_URL << 'EOF'
-- Check Posts without Authors
SELECT COUNT(*) as orphaned_posts
FROM "Post" p
WHERE p."authorId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = p."authorId");

-- Check PostCategories without Posts
SELECT COUNT(*) as orphaned_post_categories
FROM "PostCategory" pc
WHERE NOT EXISTS (SELECT 1 FROM "Post" p WHERE p.id = pc."postId");
EOF

# 4. Index status
echo -e "\n[4] Index Health"
psql -d $DB_URL -c "
  SELECT 
    schemaname, tablename, indexname,
    idx_scan as scans,
    CASE WHEN indisready THEN '✅' ELSE '❌' END as ready
  FROM pg_indexes
  LEFT JOIN pg_index ON indexname = indexrelname
  WHERE schemaname = 'public'
  ORDER BY tablename;"

# 5. Bloat analysis
echo -e "\n[5] Table Bloat"
psql -d $DB_URL -c "
  SELECT 
    current_database(),
    schemaname,
    tablename,
    ROUND(100.0 * (CASE WHEN otta=0 THEN 0.0 ELSE sml.relpages::float/otta END)::numeric, 2) AS table_bloat_ratio
  FROM (
    SELECT *,
      pg_database_size(current_database()) as db_size
    FROM pg_class
    WHERE relkind = 'r'
  ) sq
  LIMIT 20;"
```

### Verify Application Connectivity

```bash
# Test from application
curl -X GET http://localhost:3000/api/health

# Check database connection metrics
npm run db:health-check

# Verify Prisma connection
npm run db:client-validate
```

---

## Post-Recovery Steps

### Step 1: Update Monitoring

```bash
# Notify monitoring systems
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "status": "recovered",
    "incident_id": "'$INCIDENT_ID'",
    "recovered_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "method": "backup_restore"
  }' \
  https://monitoring.example.com/incidents/close

# Verify alerts are working
npm run test:alerts
```

### Step 2: Run Full Database Validation

```bash
# Run comprehensive validation
npm run db:validate:full

# Check application integration
npm run test:db:integration

# Run smoke tests
npm run test:smoke
```

### Step 3: Warm Up Caches

```bash
# Re-warm application caches if applicable
npm run cache:warm

# Verify cache connectivity
npm run cache:health-check
```

### Step 4: Document Recovery

```bash
# Create incident report
cat > incident-report-$(date +%s).md << EOF
# Incident Report: Database Recovery

**Date**: $(date)
**Duration**: [TIME]
**Impact**: [USERS AFFECTED]
**RTO Met**: YES / NO
**RPO Met**: YES / NO

## Timeline
- T+0: Incident detected
- T+X: Recovery initiated
- T+Y: Recovery completed

## Root Cause
[ANALYSIS]

## Recovery Method
[PROCEDURE USED]

## Verification
- [✅/❌] Data integrity verified
- [✅/❌] Application online
- [✅/❌] All queries functioning

## Action Items
1. [ ] Post-mortem review
2. [ ] Update monitoring
3. [ ] Improve runbooks
4. [ ] Notify stakeholders
EOF
```

### Step 5: Communicate Status

```bash
# Post to incident channel
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "text": "🟢 Database recovered successfully",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Database Recovery Complete*\n\n*Status*: Recovered\n*Time*: '$DURATION' minutes\n*Method*: '$METHOD'"
        }
      }
    ]
  }' \
  $SLACK_WEBHOOK_URL
```

---

## Rollback Procedures

### If Recovery Fails Partway

```bash
#!/bin/bash
# recovery-rollback.sh

echo "⚠️  Rolling back failed recovery..."

# 1. Stop restore process
echo "Stopping restore process..."
pkill -f pg_restore

# 2. Check database state
echo "Checking database state..."
psql -d $DB_URL -c "SELECT datfrozenxid FROM pg_database WHERE datname = current_database();"

# 3. Terminate connections
psql -d $DB_URL -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE pid != pg_backend_pid();"

# 4. Option A: Use previous backup
echo "Attempting recovery with previous backup..."
PREVIOUS_BACKUP=$(ls -t ./backups/backup-*.sql.gz | sed -n '2p')

if [ ! -z "$PREVIOUS_BACKUP" ]; then
  echo "Restoring from: $PREVIOUS_BACKUP"
  # Re-run full restore with previous backup
  bash recovery-full-restore.sh "$PREVIOUS_BACKUP"
else
  echo "❌ No previous backup available"
  echo "Manual recovery required!"
  exit 1
fi

echo "✅ Rollback complete"
```

### If Data Integrity Issues

```bash
# Revert to backup before recovery attempt
bash recovery-full-restore.sh ./backups/backup-staging-pre-migration.sql.gz

# Verify original data is restored
npm run db:validate

# Investigate root cause
npm run debug:db-corruption
```

---

## Escalation & Communication

### Escalation Path

```
L1: DevOps / Junior DBA (first response)
    ↓
    [Can handle Procedures A-C?]
    ├─ YES → Continue and document
    └─ NO → Escalate to L2
    
L2: Senior DBA / Platform Lead (procedure D-e)
    ↓
    [Recovery successful?]
    ├─ YES → Proceed to post-recovery
    └─ NO → Escalate to L3
    
L3: VP Engineering / CTO (critical decisions)
    ├─ Approve major actions
    ├─ Decide on alternative recovery methods
    └─ Coordinate with stakeholders
```

### Notification Template

```markdown
## 🚨 DATABASE INCIDENT ALERT

**Status**: ACTIVE / RESOLVING / RESOLVED

**Severity**: CRITICAL / HIGH / MEDIUM

**Affected Services**:
- Blog API: ❌ DOWN / 🟡 DEGRADED / ✅ OPERATIONAL
- Backend: ❌ / 🟡 / ✅
- Frontend: ❌ / 🟡 / ✅

**Timeline**:
- **2024-03-15 14:32 UTC**: Issue detected
- **2024-03-15 14:35 UTC**: Recovery initiated
- **2024-03-15 14:52 UTC**: Recovery completed
- **2024-03-15 15:00 UTC**: Status: RESOLVED

**Root Cause**:
[Brief technical summary]

**Next Update**:
[Time or trigger]

**Slack**: #incidents
**Status Page**: https://status.example.com
```

### Communication Channels

- **Slack**: `#incidents` (real-time updates)
- **Email**: `incidents@example.com` (log)
- **PagerDuty**: `Escalation Policy: Database`
- **Status Page**: Public status updates
- **Customers**: Email notification if > 1 hour

---

## Appendix: Command Reference

### Quick Commands
```bash
# Check database alive
psql -d $DB_URL -c "SELECT 1"

# Get database size
psql -d $DB_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()))"

# List recent backups
ls -lh ./backups/ | tail -10

# Check active recoveries
ps aux | grep restore

# Kill stuck processes
pkill -f restore

# Get recovery progress
tail -f recovery.log

# Verify data
npm run db:validate
```

### Important Files
- Backups: `./backups/`
- Logs: `/var/log/postgresql/`
- Config: `.env.production`
- Scripts: `./scripts/`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2024-03-15 | Initial SOP | Database Team |
| 1.1 | TBD | Testing feedback | TBD |
| 1.2 | TBD | Production validation | TBD |

---

**Last Tested**: [Date]
**Next Review**: [Quarterly/After Incident]
**Owner**: Database Administration Team
