# Platform-Specific Export Configuration

## Railway Backend

### 1. Create Backend Service

1. Go to [Railway.app](https://railway.app)
2. Create new service → "GitHub Repo" 
3. Select your repository
4. Configure build:
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`

### 2. Add Environment Variables

In Railway dashboard, add variables:

```
DATABASE_URL = postgresql://[user]:[password]@[host]:[port]/[database]
EXPORT_API_KEY = [generate-strong-key]
EXPORT_DIR = /tmp/exports

# Optional - S3 Backups
AWS_ACCESS_KEY_ID = [your-access-key]
AWS_SECRET_ACCESS_KEY = [your-secret-key]
AWS_REGION = us-east-1
AWS_S3_BUCKET = your-backup-bucket

# Optional - Slack Notifications
SLACK_WEBHOOK = https://hooks.slack.com/services/...

# Logs
NODE_ENV = production
VERBOSE = false
```

### 3. Set Up Cron Job (via Railway Dashboard or GitHub Actions)

**Option A: GitHub Actions** (Recommended)
- Use `.github/workflows/weekly-export.yml`
- More reliable, integrated logs

**Option B: Railway Background Worker**
- Create new service type "Background Worker"
- Link same repository
- Start command: `npm run export:weekly`
- Set cron schedule in service settings

### 4. Verify Setup

```bash
# SSH into Railway service
railway shell

# Test export
npm run export:weekly -- --dry-run
```

---

## Render Backend

### 1. Create Backend Service

1. Go to [Render.com](https://render.com)
2. Create new → "Web Service"
3. Connect GitHub repository
4. Configure:
   - **Name:** your-blog-backend
   - **Environment:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`

### 2. Create Background Worker

1. Create new → "Background Worker"
2. Same repository
3. Configure:
   - **Build Command:** `npm ci`
   - **Start Command:** `npm run export:weekly`

### 3. Add Environment Variables

In Render dashboard, Environment:

```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
EXPORT_API_KEY=[generate-strong-key]

AWS_ACCESS_KEY_ID=[your-key]
AWS_SECRET_ACCESS_KEY=[your-secret]
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket

SLACK_WEBHOOK=https://hooks.slack.com/services/...

NODE_ENV=production
```

### 4. Create Persistent Disk

1. Go to Web Service settings
2. Disks → Add Disk
3. Configure:
   - **Disk Name:** exports
   - **Mount Path:** `/var/exports`
4. Update `EXPORT_DIR=/var/exports` in environment

### 5. Set Up Cron Schedule

1. Background Worker → Environment
2. Add `BGJOBS_INTERVAL=604800` (7 days in seconds)
3. Or use GitHub Actions workflow for more control

---

## Vercel Frontend + External Backend

### 1. Configure Vercel Environment Variables

```
# Cron Configuration
BACKEND_URL=https://your-backend.railway.app
EXPORT_API_KEY=your-api-key
CRON_SECRET=your-random-secret

# These are used by /api/cron/export
```

### 2. Update vercel.json

```json
{
  "crons": [{
    "path": "/api/cron/export",
    "schedule": "0 2 * * 1"
  }]
}
```

### 3. Verify Cron Function

```bash
# Test locally
curl -X POST http://localhost:3000/api/cron/export \
  -H "authorization: Bearer your-cron-secret"
```

### 4. Monitor in Vercel Dashboard

- Deployments → Function logs
- Filter by `/api/cron/export`

**Note:** Vercel crons trigger your function, which calls the backend to run the export. The actual export happens on your backend, not Vercel.

---

## GitHub Actions (All Platforms)

### 1. Add Repository Secrets

Go to Settings → Secrets and variables → Actions:

```
DATABASE_URL
POSTGRES_URL_NON_POOLING
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET
SLACK_WEBHOOK
```

### 2. Workflow File

Use `.github/workflows/weekly-export.yml` (already provided)

### 3. Trigger Manually

- Go to Actions tab
- "Weekly Database Export"
- "Run workflow"

### 4. View Logs

- Actions tab → workflow run → logs

---

## Local Development

### 1. Copy .env.local

```bash
cp .env.example .env.local
```

### 2. Configure Locally

```bash
DATABASE_URL=postgresql://localhost/blog_dev
EXPORT_DIR=./exports
VERBOSE=true
```

### 3. Run Export

```bash
npm run export:weekly
npm run export:weekly -- --dry-run
npm run export:manage -- list
```

---

## Architecture Decision Matrix

| Requirement | Railway | Render | GitHub | Vercel |
|---|---|---|---|---|
| **Long-running jobs** | ✅ Easy | ✅ Easy | ✅ Yes (20 min) | ❌ No (60s max) |
| **Persistent storage** | ✅ Yes | ✅ Yes (disk) | ⚠️ Artifacts only | ❌ Ephemeral |
| **Scheduled runs** | ✅ Yes | ✅ Yes | ✅ Cron | ⚠️ External trigger |
| **Cost** | 💰 Medium | 💰 Medium | ✅ Free | ✅ Free |
| **Setup complexity** | ✅ Simple | ✅ Simple | ✅ Simple | ⚠️ Needs backend |
| **CLI tools available** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ Limited |

### Recommended Setup

```
┌─────────────────────────┐
│   Vercel Frontend       │
│  (ISR, SSG, API routes) │
└──────────┬──────────────┘
           │ Cron trigger
           ▼
┌─────────────────────────┐
│  Railway Backend        │
│  (Express API, exports) │
└──────────┬──────────────┘
           │
      ┌────┴────┐
      ▼         ▼
    S3      Slack
  Storage   Notify
```

Or for maximum reliability:

```
┌──────────────────────────┐
│  GitHub Actions (Weekly) │  ← Most reliable
│  + Slack notifications   │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      ▼         ▼
    S3      GitHub
  Storage   Artifacts
```

---

## Environment Variable Checklist

- [ ] `DATABASE_URL` or `POSTGRES_URL_NON_POOLING` set
- [ ] `EXPORT_API_KEY` set (minimum 32 characters)
- [ ] `EXPORT_DIR` points to persistent storage
- [ ] `AWS_*` variables configured (if using S3)
- [ ] `SLACK_WEBHOOK` set (if using notifications)
- [ ] `BACKEND_URL` set (if using Vercel cron)
- [ ] `CRON_SECRET` set (if using Vercel cron)
- [ ] All secrets marked as "production" in respective dashboards

---

## Testing Checklist

- [ ] Run with `--dry-run` flag
- [ ] Check export files created
- [ ] Verify S3 upload (if configured)
- [ ] Confirm Slack notification (if configured)
- [ ] Test status check endpoint
- [ ] Delete and restore test file
- [ ] Monitor logs for errors

---

## Support

For each platform:

- **Railway**: https://docs.railway.app
- **Render**: https://docs.render.com
- **Vercel**: https://vercel.com/docs
- **GitHub**: https://docs.github.com/en/actions

---

## Common Issues

### "POSTGRES_URL_NON_POOLING is not set"
Use direct database connection URL, not pooled connection URL.

### "Export times out"
- Check database size
- Use `POSTGRES_URL_NON_POOLING`
- Increase function timeout in platform settings

### "Permission denied" on exports directory
- Ensure directory exists
- Check write permissions
- Use absolute path in `EXPORT_DIR`

### "S3 upload fails but export succeeds"
- Verify AWS credentials are correct
- Check bucket name matches `AWS_S3_BUCKET`
- Ensure IAM user has `s3:PutObject` permission

### "Cron not triggering"
- Verify schedule syntax (cron expression)
- Check platform cron settings are enabled
- Look for function logs/errors
- Ensure secrets are set in platform
