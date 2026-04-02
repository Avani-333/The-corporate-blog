# Database Export System - Quick Reference

## 🚀 Quick Start

### Option 1: Automated with GitHub Actions
✅ **Best for:** Always-on exports with minimal setup
- Runs automatically every Monday at 2 AM UTC
- Uploads to S3 automatically
- Sends Slack notifications
- **Setup:** Add GitHub repo secrets (see EXPORT_SYSTEM_SETUP.md)

### Option 2: Automated with Vercel Cron
✅ **Best for:** Vercel frontends that need backend exports triggered
- Vercel cron calls backend to trigger export
- Backend runs the export job asynchronously
- **Setup:** Set `BACKEND_URL` and `EXPORT_API_KEY` in Vercel

### Option 3: Manual via CLI
✅ **Best for:** On-demand exports or development
```bash
# List all npm scripts
npm run export:manage -- help

# Trigger export
npm run export:manage -- trigger

# Check status
npm run export:manage -- status export-1712090400000

# List recent exports
npm run export:manage -- list

# Delete an export
npm run export:manage -- delete export-filename.sql.gz
```

### Option 4: Local Testing
✅ **Best for:** Development and testing
```bash
# Basic export
npm run export:weekly

# Dry run (test without making changes)
node scripts/weekly-export.js --dry-run

# Specific formats
node scripts/weekly-export.js --formats sql,csv

# With verbose logging
VERBOSE=true npm run export:weekly
```

## 📋 Environment Variables Needed

### For GitHub Actions
```env
DATABASE_URL or POSTGRES_URL_NON_POOLING  # Required
AWS_ACCESS_KEY_ID                         # For S3 upload
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET
SLACK_WEBHOOK                             # For notifications
```

### For Vercel Cron
```env
BACKEND_URL                               # Your backend URL
EXPORT_API_KEY                            # Matching backend API key
CRON_SECRET                               # Vercel cron secret
```

### For Backend
```env
DATABASE_URL or POSTGRES_URL_NON_POOLING  # Required
EXPORT_API_KEY                            # API key for client auth
EXPORT_DIR                                # Where to store exports
AWS_* (optional)                          # For S3 uploads
SLACK_WEBHOOK (optional)                  # For notifications
```

## 🔄 Export Flow

```
Trigger (GitHub Actions / Vercel / Manual)
    ↓
Backend Export Service
    ├─ Export SQL dump
    ├─ Export CSV files
    ├─ Compress both
    ├─ Calculate checksums
    └─ Upload to S3
    ↓
Notify (Slack / Email)
    ↓
Cleanup old exports
```

## 📊 What Gets Exported

| Format | Size | Compression | Use Case |
|--------|------|-------------|----------|
| SQL | Large | Yes (.gz) | Full database restore |
| CSV | Medium | Yes (.tar.gz) | Data analysis, bulk operations |
| JSON | Large | No (disabled) | API responses, data interchange |

## 💾 Storage Locations

- **Local**: `./exports` (4-week retention)
- **S3**: `s3://bucket/database-exports/weekly/` (90-day retention, GLACIER)
- **GitHub Artifacts**: 90-day retention

## 🛠️ Backend API Endpoints

All endpoints require `x-export-key` header with `EXPORT_API_KEY` value.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/export` | POST | Trigger new export |
| `/api/admin/export/list` | GET | List recent exports |
| `/api/admin/export/status/:jobId` | GET | Check export status |
| `/api/admin/export/:filename` | DELETE | Delete export file |

**Example:**
```bash
curl -X POST http://localhost:5000/api/admin/export \
  -H "Content-Type: application/json" \
  -H "x-export-key: your-api-key" \
  -d '{"formats":"sql,csv","dryRun":false}'
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| "No database URL found" | Set `DATABASE_URL` or `POSTGRES_URL_NON_POOLING` env var |
| Export hangs/times out | Use `POSTGRES_URL_NON_POOLING` (avoid connection pooling) |
| S3 upload fails | Check AWS credentials and bucket permissions |
| Slack notification fails | Verify webhook URL is valid |
| Vercel cron not triggering | Check `BACKEND_URL` and `EXPORT_API_KEY` |

## 📈 Monitoring

- **GitHub Actions**: Actions tab → "Weekly Database Export"
- **Vercel**: Dashboard → Deployments → Function logs
- **Backend**: Query `/api/admin/export/status/{jobId}`
- **S3**: List bucket → `database-exports/weekly/`

## 📝 File Naming

```
export-[env]-w[week]-[date].[format]
```

Example: `export-production-w13-2026-04-01.sql.gz`

## 💰 Cost Optimization

- ✅ Uses GLACIER storage class ($0.004/GB/month vs $0.023 standard)
- ✅ Auto-transitions to GLACIER after 30 days
- ✅ Compression saves 80-90% on SQL dumps
- ✅ Local cleanup removes files older than 4 weeks

## 🔐 Security

- ✅ API key authentication on all endpoints
- ✅ Checksums verify file integrity
- ✅ Sensitive data excluded from logs
- ✅ No credentials in responses

## 📚 Full Documentation

See `docs/EXPORT_SYSTEM_SETUP.md` for complete setup guide.

## 👨‍💻 Development Commands

```bash
# Run export locally
npm run export:weekly

# Test with dry-run (no actual changes)
npm run export:weekly -- --dry-run

# Manage exports from CLI
npm run export:manage -- trigger
npm run export:manage -- list
npm run export:manage -- status <jobId>

# Check help
npm run export:manage -- help
```

## 🎯 Next Steps

1. **Choose deployment method:** GitHub Actions / Vercel Cron / Backend
2. **Set environment variables:** Copy from section above
3. **Test first:** Use `--dry-run` to verify setup
4. **Enable notifications:** Add Slack webhook for alerts
5. **Monitor:** Check logs to ensure exports run successfully

---

**Questions?** See `docs/EXPORT_SYSTEM_SETUP.md` for detailed documentation.
