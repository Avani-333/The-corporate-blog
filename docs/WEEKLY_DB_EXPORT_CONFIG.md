# Weekly Database Export Configuration

## Overview

The weekly database export system automatically exports your PostgreSQL database to multiple formats (SQL, CSV) and stores them locally and in S3 for backup and compliance purposes.

## Quick Start

### Manual Export

```bash
# Basic export (uses .env configuration)
npm run export:weekly

# Verbose output for debugging
npm run export:manual

# Custom directory
EXPORT_DIR=/backups npm run export:weekly

# Specific formats
EXPORT_FORMATS=sql,csv npm run export:weekly
```

### Automated Weekly Export (Cron)

```bash
# 1. Make script executable
chmod +x scripts/weekly-export-cron.sh

# 2. Add to crontab (runs every Sunday at 2 AM)
crontab -e

# Add this line:
0 2 * * 0 /bin/bash -c 'cd /app && NODE_ENV=production ./scripts/weekly-export-cron.sh'

# 3. Verify crontab entry
crontab -l | grep weekly-export
```

## Configuration

### Environment Variables

Create or update `.env.production` and `.env.staging`:

```bash
# Database
DATABASE_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."

# Export settings
EXPORT_DIR="./exports"              # Local export directory
NODE_ENV="production"               # Environment: development, staging, production

# S3 Storage (Optional but Recommended)
AWS_REGION="us-east-1"
AWS_S3_BUCKET="corporate-blog-backups"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# Slack Notifications (Optional)
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Logging
LOG_DIR="./logs"
VERBOSE="false"
```

### Export Policies

**Retention Policy** (Local):
- Keep 4 weeks of weekly exports locally
- Automatic cleanup of exports older than 30 days
- Max storage: ~100GB

**S3 Storage** (Cloud):
- Store for 90 days as-is
- Transition to GLACIER after 30 days (cost optimization)
- Long-term retention available via Glacier

**Format Selection**:

| Format | Size | Use Case | Enabled |
|--------|------|----------|---------|
| SQL | Medium | Full database restore, version control | ✅ Yes |
| CSV | Small | Data analysis, spreadsheet import | ✅ Yes |
| JSON | Large | Application data dumps | ❌ No (by default) |

## Directory Structure

```
exports/
├── export-staging-w11-2024-03-15.sql.gz      # SQL compressed
├── export-staging-w11-2024-03-15.tar.gz      # CSV archive
├── export-staging-w10-2024-03-08.sql.gz      # Previous week
└── export-staging-w10-2024-03-08.tar.gz
```

## Output Files

### SQL Export

```
export-[env]-w[week]-[YYYY-MM-DD].sql.gz

Example:
export-production-w12-2024-03-20.sql.gz
├── Size: 120-500MB
├── Type: PostgreSQL dump (gzip compressed)
├── Can be restored with: psql < file.sql
└── Compression: ~5:1 typical ratio
```

### CSV Export

```
export-[env]-w[week]-[YYYY-MM-DD].tar.gz

Example:
export-production-w12-2024-03-20.tar.gz
├── Size: 20-50MB
├── Contents: Individual CSV files per table
├── Structure:
│   ├── user.csv
│   ├── post.csv
│   ├── category.csv
│   └── ...other tables
└── Best for: Data analysis, imports to other systems
```

## Usage Examples

### Restore from SQL Export

```bash
# Decompress
gunzip export-production-w12-2024-03-20.sql.gz

# Restore to database
psql -U postgres -d your_database < export-production-w12-2024-03-20.sql

# Restore specific schema
psql -U postgres -d your_database \
  -f export-production-w12-2024-03-20.sql \
  --echo-queries

# Restore with progress
pv export-production-w12-2024-03-20.sql | psql -U postgres -d your_database
```

### Extract Specific Table from SQL

```bash
# View available tables
pg_restore --list export-production-w12-2024-03-20.sql.gz | head -20

# Extract single table
pg_restore --table="User" \
  export-production-w12-2024-03-20.sql.gz > users_only.sql

# Restore table to database
psql -d your_database < users_only.sql
```

### Use CSV Export

```bash
# Extract
tar -xzf export-production-w12-2024-03-20.tar.gz

# View table
head -20 user.csv

# Import to tool
# - Import to Excel/Sheets
# - Load into analytics tool
# - Parse with Python/Node script
```

### Download from S3

```bash
# List available exports
aws s3 ls s3://corporate-blog-backups/database-exports/weekly/

# Download specific file
aws s3 cp \
  s3://corporate-blog-backups/database-exports/weekly/export-production-w12-2024-03-20.sql.gz \
  ./export.sql.gz

# Download all exports from this week
aws s3 sync \
  s3://corporate-blog-backups/database-exports/weekly/ \
  ./exports/ \
  --exclude "*" --include "export-production-w12-*"
```

## Monitoring & Alerts

### Check Export Status

```bash
# Last export
ls -lh exports/ | tail -5

# Export size trend
du -sh exports/

# Verify files are being created
find exports/ -type f -mtime -7

# Check S3 backups
aws s3 ls s3://corporate-blog-backups/database-exports/weekly/ --recursive
```

### Slack Notifications

The system automatically sends Slack notifications after each export:

```
📊 Weekly Database Export Complete
Environment: production
Week: 12
Date: 2024-03-20
Status: ✅ Success

Exports
SQL: export-production-w12-2024-03-20.sql.gz
Size: 245.32MB
CSV: export-production-w12-2024-03-20.tar.gz
Size: 32.15MB

Local: ./exports/ | Cloud: corporate-blog-backups
```

### Email Reports

To receive email reports, add email notification support:

```bash
# Add to cron wrapper
EXPORT_NOTIFICATION_EMAIL="devops@example.com" npm run export:weekly
```

## Troubleshooting

### Export Fails with "No Database URL"

```bash
# Verify environment variables are loaded
echo $POSTGRES_URL_NON_POOLING

# Solution: Source .env file
source .env.production
npm run export:weekly
```

### Disk Space Issues

```bash
# Check available space
df -h ./exports/

# Clean old exports manually
rm ./exports/export-staging-w8-*.* 

# Increase retention (modify script):
retention.local.days = 7  # Keep 7 weeks instead of 4
```

### S3 Upload Fails

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check bucket permissions
aws s3 ls s3://corporate-blog-backups/

# Verify bucket exists
aws s3api head-bucket --bucket corporate-blog-backups

# If credentials are invalid:
aws configure
# Set: Access Key, Secret Key, Region, Output
```

### Export Too Large

```bash
# Solution 1: Exclude tables (not recommended)
# Modify EXPORT_CONFIG.options.excludeTables in weekly-export.js

# Solution 2: Use compression
gzip -9 export.sql  # Maximum compression

# Solution 3: Schedule more frequently (daily)
# Modify cron to: 0 2 * * * (daily at 2 AM)

# Solution 4: Increase retention but decrease frequency
# Keep backups for 90 days, export only on Sundays
```

### Slow Exports

Typical times:
- Small DB (< 100MB): 2-5 minutes
- Medium DB (100MB-1GB): 5-15 minutes
- Large DB (1GB-10GB): 15-60 minutes

Optimization:

```bash
# 1. Export during low-traffic period
# Change cron time: 0 3 * * 0 (3 AM instead of 2 AM)

# 2. Disable CSV export if not needed
# In script: formats.csv.enabled = false

# 3. Use parallel export (if available)
# Modify: EXPORT_CONFIG.options.parallel = 8

# 4. Monitor database query performance
npm run db:monitor
npm run db:health-check
```

## Compliance & Retention

### Data Retention Rules

```
DEVELOPMENT:
└─ 7 days local retention
└─ No cloud storage

STAGING:
├─ 30 days local retention
└─ 90 days S3 standard storage
   └─ Transitions to Glacier after 30 days

PRODUCTION:
├─ 30 days local retention
└─ 1 year S3 with Glacier transition:
   ├─ 30 days: Standard
   ├─ 30-365 days: Glacier
   └─ 365+ days: Deep Archive (if retention needed)
```

### GDPR Compliance

If you process GDPR data, ensure:

1. ✅ Data is encrypted (use S3 encryption)
2. ✅ Access is logged (use S3 access logs)
3. ✅ Retention follows policy (use S3 lifecycle rules)
4. ✅ Deletion is possible (implement data export/deletion tools)

To enable S3 encryption:

```bash
# Server-side encryption
aws s3api put-bucket-encryption \
  --bucket corporate-blog-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

## Scheduled Exports

### Default Schedule

- **Day**: Sunday
- **Time**: 2 AM UTC
- **Frequency**: Weekly
- **Formats**: SQL (compressed) + CSV (compressed)
- **Storage**: Local + S3 Glacier

### Custom Schedules

**Daily Exports** (for high-traffic sites):
```bash
# Edit crontab
# Daily at 3 AM
0 3 * * * /bin/bash -c 'cd /app && ./scripts/weekly-export-cron.sh'
```

**Multiple Schedules** (different environments):
```bash
# Staging: Weekly Sunday 2 AM
0 2 * * 0 NODE_ENV=staging /bin/bash -c 'cd /app && ./scripts/weekly-export-cron.sh'

# Production: Sunday & Wednesday 3 AM
0 3 * * 0,3 NODE_ENV=production /bin/bash -c 'cd /app && ./scripts/weekly-export-cron.sh'
```

**Real-time Continuous Backup** (advanced):
```bash
# Implement WAL-E / WAL-G for continuous archiving to S3
# See: https://neon.tech/docs/manage/backups
```

## Integration with Monitoring

### DataDog Integration

```javascript
// Add to weekly-export.js
const dogstatsd = require('node-dogstatsd').StatsD;
const client = new dogstatsd();

// Track export metrics
client.gauge('db.export.size_mb', fileSizeMB);
client.histogram('db.export.duration_seconds', duration);
client.increment('db.export.success', 1, ['env:production']);
```

### Sentry Integration

```javascript
// Already integrated in the script
const Sentry = require('@sentry/node');

Sentry.captureMessage('Weekly export completed', 'info', {
  env: getEnvironment(),
  size: totalSize,
  duration: duration
});
```

## Best Practices

1. ✅ **Test Restores Regularly**
   - Monthly restore test from latest backup
   - Verify data integrity after restore
   - Document successful restores

2. ✅ **Monitor Export Logs**
   - Check export logs weekly
   - Alert on failures
   - Track size trends

3. ✅ **Maintain Offline Copies**
   - Download critical exports
   - Store in secure location
   - Update quarterly

4. ✅ **Document Procedures**
   - Keep runbooks updated
   - Document custom configurations
   - Share with team

5. ✅ **Automate Verification**
   - Run integrity checks on imports
   - Validate row counts match
   - Monitor disk usage

## Support & References

- PostgreSQL Manual: https://www.postgresql.org/docs/
- Neon Backups: https://neon.tech/docs/manage/backups
- AWS S3 Lifecycle: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html
- pg_dump reference: https://www.postgresql.org/docs/current/app-pgdump.html

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-03-20 | Initial setup | DevOps Team |
| - | Dual format export (SQL+CSV) | - |
| - | S3 integration with Glacier | - |
| - | Slack notifications | - |
| - | Automatic cleanup | - |

---

**Last Updated**: March 2024
**Maintained By**: Database Administration Team
**Review Frequency**: Quarterly
