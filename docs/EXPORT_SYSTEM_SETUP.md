# Database Export System Setup Guide

## Overview

The Corporate Blog has a comprehensive database export system that supports multiple deployment options:

1. **GitHub Actions** - Scheduled automated exports
2. **Vercel Cron** - Vercel-native cron scheduling  
3. **Manual Backend Trigger** - On-demand exports via API
4. **Local Development** - Export from command line

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Export Trigger Points                   │
├─────────────────┬─────────────────┬─────────────┤
│ GitHub Actions  │ Vercel Cron     │ Manual API  │
│ (Scheduled)     │ (Scheduled)     │ (On-demand) │
└────────┬────────┴────────┬────────┴────────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Backend    │
                    │  Export API │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐    ┌─────▼─────┐
    │ Local    │      │   S3      │    │  Slack    │
    │ Storage  │      │ (GLACIER) │    │  Notify   │
    └──────────┘      └───────────┘    └───────────┘
```

## Setup Instructions

### 1. Environment Variables

Add the following to your deployment backends:

```env
# Required
DATABASE_URL=postgresql://user:pass@host/db
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host/db  # Direct connection, no pooling

# Optional - AWS S3 Storage
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-backup-bucket

# Optional - Slack Notifications
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional - API Authentication
EXPORT_API_KEY=your-secure-api-key

# Optional - Vercel Cron
CRON_SECRET=your-vercel-cron-secret
BACKEND_URL=https://your-backend.railway.app

# Export Configuration
NODE_ENV=production
EXPORT_DIR=/persistent-storage/exports  # Must be persistent across deployments
VERBOSE=false  # Enable detailed logging
```

### 2. Configure GitHub Actions

The workflow `weekly-export.yml` runs automatically every Monday at 2 AM UTC.

**To enable GitHub Actions exports:**

1. Add secrets to GitHub repository:
   - `DATABASE_URL` or `POSTGRES_URL_NON_POOLING`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `AWS_S3_BUCKET`
   - `SLACK_WEBHOOK`

2. The workflow will:
   - Export database to SQL and CSV formats
   - Compress the exports
   - Upload to S3 with GLACIER storage class
   - Send Slack notification
   - Upload to GitHub Artifacts (90-day retention)

**Manual trigger:** Go to Actions → "Weekly Database Export" → "Run workflow"

### 3. Configure Vercel Cron (Recommended for Vercel Frontend)

The Vercel cron function calls your backend to trigger exports.

**Setup:**

1. Add `CRON_SECRET` to Vercel environment variables:
   ```
   CRON_SECRET=<generate-random-secret>
   ```

2. Add `BACKEND_URL` (your Railway/Render deployment):
   ```
   BACKEND_URL=https://your-backend.railway.app
   EXPORT_API_KEY=<matching-api-key-from-backend>
   ```

3. The cron runs every Monday at 2 AM UTC (configured in `vercel.json`)

### 4. Backend Export API

The backend provides REST endpoints for export management.

**Trigger Export:**
```bash
curl -X POST https://your-backend.railway.app/api/admin/export \
  -H "Content-Type: application/json" \
  -H "x-export-key: your-api-key" \
  -d '{
    "formats": "sql,csv",
    "dryRun": false,
    "includeCleanup": true
  }'
```

**Response:**
```json
{
  "jobId": "export-1712090400000",
  "message": "Export started",
  "statusUrl": "/api/admin/export/status/export-1712090400000"
}
```

**Check Status:**
```bash
curl https://your-backend.railway.app/api/admin/export/status/export-1712090400000 \
  -H "x-export-key: your-api-key"
```

**List Recent Exports:**
```bash
curl https://your-backend.railway.app/api/admin/export/list \
  -H "x-export-key: your-api-key"
```

**Delete Export:**
```bash
curl -X DELETE https://your-backend.railway.app/api/admin/export/export-filename.sql.gz \
  -H "x-export-key: your-api-key"
```

### 5. Local Development

**Run export locally:**
```bash
npm run export:weekly
```

**With options:**
```bash
# Dry run
node scripts/weekly-export.js --dry-run

# Specific formats
node scripts/weekly-export.js --formats sql,csv

# Skip cleanup
node scripts/weekly-export.js --no-cleanup

# Skip S3 upload
node scripts/weekly-export.js --no-s3

# Verbose logging
VERBOSE=true node scripts/weekly-export.js
```

**Get help:**
```bash
node scripts/weekly-export.js --help
```

## Deployment Configuration

### Railway Backend

1. Add environment variables in Railway dashboard
2. Add a cron command to `package.json`:
   ```json
   {
     "scripts": {
       "cron:export": "node scripts/weekly-export.js",
       "export:weekly": "node scripts/weekly-export.js"
     }
   }
   ```

3. Set up background worker (if Railway supports):
   - Command: `npm run cron:export`
   - Schedule: `0 2 * * 1` (every Monday 2 AM)

### Render Backend

1. Create a new "Background Task" service in Render
2. Link to your GitHub repository
3. Set build command: `npm ci`
4. Set start command: `npm run cron:export`
5. Add environment variables from the list above
6. Set to run on schedule

### Persistent Storage

**For Railway:**
```bash
# Create volume in Railway dashboard
# Set EXPORT_DIR to mount point
EXPORT_DIR=/var/run/exports
```

**For Render:**
```bash
# Create disk in Render dashboard
# Set EXPORT_DIR to mount point
EXPORT_DIR=/persistent_disk/exports
```

## Monitoring

### View Export Logs

**GitHub Actions:**
- Go to Actions tab → "Weekly Database Export" → view logs

**Vercel:**
- Go to Vercel dashboard → Deployments → view function logs

**Backend API:**
- Query status endpoint: `/api/admin/export/status/{jobId}`

### S3 Monitoring

Monitor exports in S3:
```bash
# List all exports
aws s3 ls s3://your-bucket/database-exports/weekly/ --recursive

# Check storage class
aws s3api head-object \
  --bucket your-bucket \
  --key database-exports/weekly/export-filename.sql.gz
```

### Slack Notifications

Export completion/failure notifications sent to configured webhook.

Example failure notification includes:
- Error details
- Timestamp
- Environment
- Link to logs

## Retention Policy

| Storage | Retention | Class |
|---------|-----------|-------|
| Local | 4 weeks | Standard |
| S3 | 90 days from creation | GLACIER (30 days auto-transition) |
| GitHub Artifacts | 90 days | Standard |

## Troubleshooting

### Export Fails with "No database URL found"

**Solution:** Ensure `DATABASE_URL` or `POSTGRES_URL_NON_POOLING` is set in environment

### Export Hangs/Times Out

**Solution:** 
- Increase timeout in backend configuration
- Use `POSTGRES_URL_NON_POOLING` (not pooled connection)
- Check database size and connection limits

### S3 Upload Fails

**Solution:**
- Verify AWS credentials are correct
- Check S3 bucket permissions
- Ensure bucket exists in specified region

### Slack Notification Fails

**Solution:**
- Verify webhook URL is correct and active (not expired)
- Check Slack workspace permissions

### Storage Space Issues

**Solution:**
- Run cleanup manually: `node scripts/weekly-export.js --no-cleanup` then manually delete old files
- Adjust retention policy for local storage
- Monitor S3 storage costs

## Security Considerations

✅ **What's Protected:**
- API key required for all export endpoints
- Endpoint verification for Vercel cron
- No sensitive data in logs
- Checksums stored for file integrity

⚠️ **Best Practices:**
- Use strong `EXPORT_API_KEY` (minimum 32 characters)
- Regenerate `CRON_SECRET` periodically
- Limit S3 bucket access to specific IAM users
- Enable S3 bucket versioning
- Monitor export access logs
- Rotate Slack webhook URLs annually

## Cost Optimization

- **S3 Storage**: GLACIER class ($.004/GB/month vs standard $.023/GB/month)
- **Auto-transition**: Exports transition to GLACIER after 30 days
- **Local cleanup**: Removes files older than 4 weeks to save storage
- **Compression**: Achieves 80-90% reduction on SQL dumps

## Examples

### Monitoring Dashboard Script

```bash
#!/bin/bash
# monitor-exports.sh

BACKEND_URL="https://your-backend.railway.app"
API_KEY="your-api-key"

echo "=== Recent Exports ==="
curl -s "$BACKEND_URL/api/admin/export/list" \
  -H "x-export-key: $API_KEY" | jq '.exports | .[] | "\(.filename) - \(.size) - \(.modified)"'

echo ""
echo "=== Total Storage ==="
curl -s "$BACKEND_URL/api/admin/export/list" \
  -H "x-export-key: $API_KEY" | jq '.total'
```

### Automated Backup Verification

Run this as a post-export health check:

```bash
#!/bin/bash
# verify-export.sh

JOB_ID=$1

while true; do
  STATUS=$(curl -s "$BACKEND_URL/api/admin/export/status/$JOB_ID" \
    -H "x-export-key: $API_KEY" | jq '.status')
  
  if [ "$STATUS" = '"completed"' ]; then
    echo "✅ Export completed successfully"
    exit 0
  elif [ "$STATUS" = '"failed"' ]; then
    echo "❌ Export failed"
    exit 1
  fi
  
  sleep 30
done
```

## Support

For issues or questions:
1. Check logs in GitHub Actions / Vercel / Backend
2. Review troubleshooting section above
3. Verify environment variables are set correctly
4. Test with `--dry-run` flag to isolate issues
