# Neon Backup & Restore Test Plan

## Overview
This document outlines the comprehensive testing strategy for database backup and restore operations on Neon PostgreSQL in staging and production environments.

## Environment Details

| Environment | Database | Connection Type | Pool Size | Backup Retention |
|-------------|----------|-----------------|-----------|-----------------|
| Staging | Neon (Staging Branch) | Pooling + Direct | 25/unlimited | 30 days |
| Production | Neon (Main Branch) | Pooling + Direct | 25/unlimited | 90 days |

## Neon-Specific Considerations

### Backup Methods Available

1. **Native Neon Backups**
   - Automatic daily backups (included)
   - Point-in-time recovery (PITR) up to 7 days
   - Manual snapshots via Neon Console
   - No additional configuration needed

2. **Logical Backups (pg_dump)**
   - Full database schema and data
   - Portable across PostgreSQL versions
   - Compressible for storage efficiency

3. **WAL-E / WAL-G Backups**
   - Continuous archiving for point-in-time recovery
   - S3 integration for off-site storage

## Test Categories

### Category 1: Basic Backup Operations (Week 1)

#### Test 1.1: Create Full Backup
**Objective**: Verify pg_dump creates complete backup
**Environment**: Staging
**Procedure**:
```bash
# Test backup creation
NODE_ENV=staging npm run migrate:backup

# Verify backup file
ls -lh backups/backup-staging-*.sql.gz
file backups/backup-staging-*.sql.gz  # Should show gzip archive
```
**Expected Results**:
- ✅ Backup file created successfully
- ✅ File size > 1MB (indicates data capture)
- ✅ Compression confirmed by file command
- ✅ Checksum generated and logged

**Success Criteria**: Backup completes in < 5 minutes, no errors

---

#### Test 1.2: Backup Integrity Verification
**Objective**: Confirm backup file is valid and not corrupted
**Environment**: Staging
**Procedure**:
```bash
# Test gzip integrity
gzip -t backups/backup-staging-*.sql.gz

# Test PostgreSQL restore without committing
pg_restore --data-only --schema-only \
  backups/backup-staging-*.sql.gz | head -100
```
**Expected Results**:
- ✅ No gzip errors
- ✅ Valid PostgreSQL commands in output
- ✅ Schema and data present

**Success Criteria**: All integrity checks pass

---

#### Test 1.3: Backup Metadata Validation
**Objective**: Ensure backup contains essential metadata
**Environment**: Staging
**Procedure**:
```bash
# Decompress and check header
gzip -dc backups/backup-staging-*.sql.gz | head -30

# Check for table definitions
gzip -dc backups/backup-staging-*.sql.gz | grep "CREATE TABLE"
```
**Expected Results**:
- ✅ PostgreSQL dump header present
- ✅ All tables in CREATE TABLE statements
- ✅ Schema matches current database

---

### Category 2: Basic Restore Operations (Week 2)

#### Test 2.1: Restore to Staging Environment
**Objective**: Successfully restore backup to staging
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Create test database
createdb staging_restore_test

# Restore backup
NODE_ENV=staging npm run migrate:restore backups/backup-staging-*.sql.gz

# Run validation queries
psql -d thecorporateblog_staging -c "SELECT COUNT(*) as user_count FROM \"User\";"
psql -d thecorporateblog_staging -c "SELECT COUNT(*) as post_count FROM \"Post\";"
```
**Expected Results**:
- ✅ Restore completes without errors
- ✅ Row counts match pre-backup state
- ✅ All tables present and accessible
- ✅ Indexes rebuilt successfully

**Success Criteria**: All data restored, row counts verified

---

#### Test 2.2: Data Consistency Post-Restore
**Objective**: Verify data integrity after restore
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Run validation script
npm run db:validate

# Check foreign key constraints
psql -d thecorporateblog_staging -c "
  SELECT constraint_name, table_name 
  FROM information_schema.table_constraints 
  WHERE constraint_type = 'FOREIGN KEY';"

# Validate relationships
psql -d thecorporateblog_staging -c "
  SELECT p.id, p.title, u.username 
  FROM \"Post\" p 
  LEFT JOIN \"User\" u ON p.\"authorId\" = u.id 
  WHERE u.id IS NULL AND p.\"authorId\" IS NOT NULL 
  LIMIT 5;"
```
**Expected Results**:
- ✅ No orphaned foreign keys
- ✅ All relationships intact
- ✅ Data matches pre-backup

---

#### Test 2.3: Restore with Schema Verification
**Objective**: Ensure schema matches after restore
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Compare schema before and after
pg_dump -s thecorporateblog_staging | md5sum > schema_after.md5

# Compare column counts
psql -d thecorporateblog_staging -c "
  SELECT table_name, COUNT(*) as column_count 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  GROUP BY table_name ORDER BY table_name;"
```
**Expected Results**:
- ✅ Schema checksum matches original
- ✅ Column counts match previous

---

### Category 3: Point-in-Time Recovery (Week 3)

#### Test 3.1: PITR Using Neon Console
**Objective**: Test Neon's PITR capability
**Environment**: Staging
**Procedure**:
1. Note current timestamp: `date -u '+%Y-%m-%d %H:%M:%S'`
2. Create test data
3. Access Neon Console > Branches
4. Select "Create from backup" for staging branch
5. Choose point-in-time 5 minutes ago
6. Verify data reverted

**Expected Results**:
- ✅ PITR completes in < 30 seconds
- ✅ Data rolled back to previous state
- ✅ New branch created successfully
- ✅ Connections pooling works on recovered branch

---

#### Test 3.2: Compare PITR vs Full Restore
**Objective**: Verify PITR is faster than full restore
**Environment**: Staging
**Procedure**:
```bash
# Time full restore
time npm run migrate:restore backups/backup-staging-*.sql.gz

# Time PITR via Neon (manual via console)
# Record both durations
```
**Expected Results**:
- ✅ PITR < 1 minute
- ✅ Full restore typically 2-5 minutes
- ✅ PITR is preferred for recent recovery needs

---

### Category 4: Restore Scenarios (Week 4)

#### Test 4.1: Partial Restore (Table Only)
**Objective**: Restore specific table from backup
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Extract single table
pg_restore --table=\"User\" \
  backups/backup-staging-*.sql.gz > user_table.sql

# Restore to test database
psql -d test_db < user_table.sql

# Verify
psql -d test_db -c "SELECT COUNT(*) FROM \"User\";"
```
**Expected Results**:
- ✅ Single table extracted successfully
- ✅ Only specified table restored
- ✅ Row count matches original

---

#### Test 4.2: Restore with Data Transformation
**Objective**: Test restore + data transformation pipeline
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Restore to separate schema
npm run migrate:restore backups/backup-staging-*.sql.gz --target-schema=restored

# Validate transformation capability
psql -d thecorporateblog_staging -c "
  SELECT schema_name FROM information_schema.schemata 
  WHERE schema_name = 'restored';"
```
**Expected Results**:
- ✅ Schema isolation works
- ✅ Data available in alternate schema
- ✅ No conflicts with production data

---

#### Test 4.3: Failed Restore Recovery
**Objective**: Test recovery from failed restore
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Simulate restore failure
NODE_ENV=staging npm run migrate:restore nonexistent-backup.sql.gz

# Verify system state
npm run db:health-check

# Confirm rollback occurred
psql -d thecorporateblog_staging -c "SELECT version();"
```
**Expected Results**:
- ✅ Graceful error handling
- ✅ Database remains accessible
- ✅ No partial data
- ✅ Clear error messages logged

---

### Category 5: Performance Tests (Week 5)

#### Test 5.1: Large Backup Creation
**Objective**: Performance test with large dataset
**Environment**: Staging
**Data**: 1M+ posts with comments and analytics
**Procedure**:
```bash
# Load test data
npm run seed:large-dataset

# Time backup operation
time NODE_ENV=staging npm run migrate:backup

# Record metrics
echo "Backup size: $(du -h backups/backup-staging-*.sql.gz)"
```
**Expected Results**:
- ✅ Backup completes in reasonable time (< 30 min)
- ✅ Compression ratio > 5:1
- ✅ No database performance impact

---

#### Test 5.2: Large Restore Operation
**Objective**: Performance test large restore
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Time restore of large backup
time NODE_ENV=staging npm run migrate:restore backups/backup-staging-*.sql.gz

# Monitor during restore
# - CPU usage should stay < 80%
# - Memory usage should stay < 2GB
# - Disk I/O should be smooth
```
**Expected Results**:
- ✅ Restore completes in < 60 minutes
- ✅ System remains responsive
- ✅ Proper resource utilization

---

#### Test 5.3: Concurrent Operations
**Objective**: Test restore with active connections
**Environment**: Staging (staging-test branch)
**Procedure**:
```bash
# Open read-only connections
psql -d thecorporateblog_staging -c "BEGIN TRANSACTION ISOLATION LEVEL READ ONLY; SELECT 1;" &
psql -d thecorporateblog_staging -c "BEGIN TRANSACTION ISOLATION LEVEL READ ONLY; SELECT 1;" &

# Attempt restore in parallel
NODE_ENV=staging npm run migrate:restore backups/backup-staging-*.sql.gz

# Verify conflicts resolution
npm run db:health-check
```
**Expected Results**:
- ✅ Restore waits for active transactions properly
- ✅ No deadlocks occur
- ✅ All operations complete successfully

---

### Category 6: Automated Backup Validation (Ongoing)

#### Test 6.1: Weekly Backup Integrity Check
**Objective**: Automated validation of weekly backups
**Environment**: Staging
**Frequency**: Every Monday 3 AM
**Procedure**:
```bash
# Run automated integrity check
npm run backup:validate

# Generate report
npm run backup:report --format=json --output=backup-report.json
```
**Expected Results**:
- ✅ All backups verified
- ✅ Report generated and emailed
- ✅ Alerts triggered if issues found

---

#### Test 6.2: Backup Retention Policy Verification
**Objective**: Confirm retention policies are enforced
**Environment**: Staging
**Procedure**:
```bash
# Check backup age
ls -l backups/ | awk '{print $6, $7, $8, $9}'

# Verify old backups deleted
# Expected: Only last 30 days retained

# Check storage usage
du -sh backups/
```
**Expected Results**:
- ✅ Backups > 30 days deleted
- ✅ Storage < 50GB
- ✅ Retention policy enforced

---

## Execution Schedule

```
Week 1 (Tests 1.1-1.3): Basic Backup - Monday-Wednesday
Week 2 (Tests 2.1-2.3): Basic Restore - Thursday-Saturday
Week 3 (Test 3.1-3.2): PITR - Next Monday-Tuesday
Week 4 (Tests 4.1-4.3): Restore Scenarios - Wednesday-Friday
Week 5 (Tests 5.1-5.3): Performance - Next Monday-Wednesday
Ongoing: Category 6 automation - Automated weekly
```

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Backup Success Rate | 99.9% | TBD |
| Backup Creation Time | < 5 min | TBD |
| Complete Restore Time | < 10 min | TBD |
| PITR Time | < 2 min | TBD |
| Database Uptime During Backup | > 99.9% | TBD |
| Backup Integrity Validation | 100% | TBD |
| Recovery Point Objective (RPO) | 1 hour | ✅ Met |
| Recovery Time Objective (RTO) | 4 hours | TBD |

## Test Results Template

### Test [X.X]: [Test Name]
- **Status**: PASS / FAIL
- **Duration**: [Time taken]
- **Date**: [YYYY-MM-DD]
- **Tester**: [Name]
- **Notes**: [Any observations]
- **Issues Found**: [If any]
- **Follow-up**: [If required]

## Error Scenarios to Test

1. **Corrupted Backup File**
   - Create intentionally broken backup
   - Attempt restore
   - Verify proper error handling

2. **Insufficient Disk Space**
   - Simulate low disk space
   - Attempt restore
   - Verify graceful failure

3. **Network Interruption During Restore**
   - Kill connection mid-restore
   - Verify rollback and safety
   - Confirm database consistency

4. **Permission Errors**
   - Restore with wrong user credentials
   - Verify access control works

5. **Version Mismatches**
   - Attempt restore with different PostgreSQL version
   - Document compatibility

## Rollback Procedures

If issues occur during restore:

```bash
# 1. Stop the restore process (Ctrl+C)
# 2. Check database status
npm run db:health-check

# 3. If database is locked
psql -d thecorporateblog_staging -c "
  SELECT pid, usename, pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = 'thecorporateblog_staging' AND pid <> pg_backend_pid();"

# 4. If full rollback needed, restore from previous backup
npm run migrate:restore backups/backup-staging-previous.sql.gz

# 5. Verify restored state
npm run db:health-check
npm run db:validate
```

## Monitoring During Tests

- Monitor CPU, Memory, Disk I/O
- Check connection pool status
- Monitor Neon dashboard metrics
- Log all operations to test log file
- Take before/after data snapshots

## Documentation

After each test session:
1. Document results in test results template
2. Update metrics table
3. Create GitHub issues for any failures
4. Notify team of status via Slack #database channel
5. Archive test data for future reference

## Approval Criteria

Before deploying to production:
- ✅ All Category 1-4 tests PASS
- ✅ Category 5 performance tests meet targets
- ✅ No critical bugs found
- ✅ RTO/RPO objectives met
- ✅ Documentation complete and reviewed
- ✅ Team sign-off received
