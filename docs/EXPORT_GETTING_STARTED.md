# Export System - Getting Started Checklist

## 📋 Choose Your Deployment Method

Choose **one primary method** (you can use multiple):

### Option 1: GitHub Actions (Easiest, Most Reliable)
- **Pros:** Free, reliable, built-in logs, no backend needed
- **Cons:** Database must be accessible from GitHub
- **Time to setup:** 5 minutes
- **Choose this if:** You want set-it-and-forget-it

### Option 2: Vercel Cron + Backend (Recommended for Production)
- **Pros:** Scalable, serverless, built into Vercel
- **Cons:** Requires backend service
- **Time to setup:** 15 minutes
- **Choose this if:** You use Vercel frontend + Railway/Render backend

### Option 3: Manual CLI (Development/Testing)
- **Pros:** Immediate, on-demand, easy testing
- **Cons:** Manual triggering, not automated
- **Time to setup:** 0 minutes
- **Choose this if:** You want to test or backup on-demand

---

## 🚀 Quick Setup Guide

### Setup Phase 1: Core Configuration (5 min)

#### Step 1: Get Database Connection String
```bash
# You need ONE of these:
DATABASE_URL=postgresql://user:pass@host:port/db
# OR
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host:port/db
```

- Check your Neon dashboard
- Copy the "Direct connection" string (not pooled)
- Keep this secret! 🔐

#### Step 2: Generate API Key
```bash
# Generate a strong random key (minimum 32 characters)
openssl rand -base64 32
# Result: something like: ABC123def456GHI789jkl012ABC345def==
```

Save this somewhere safe.

#### Step 3: Test Local Export (Optional but Recommended)
```bash
cd "The corporate blog"

# Set env vars temporarily
export DATABASE_URL="postgresql://..."
export VERBOSE=true

# Test with dry-run (no actual changes)
npm run export:weekly -- --dry-run
```

If this works, your database connection is good! ✅

---

### Setup Phase 2: Choose Deployment

#### 🎯 Setup Path A: GitHub Actions

**Time: 5 minutes**

1. Go to your GitHub repo
2. Settings → Secrets and variables → Actions
3. Click "New repository secret" and add:
   - Name: `DATABASE_URL` → Value: `postgresql://...`
   - (Or `POSTGRES_URL_NON_POOLING` instead)

4. For S3 storage (optional):
   - `AWS_ACCESS_KEY_ID` → Your AWS key
   - `AWS_SECRET_ACCESS_KEY` → Your AWS secret
   - `AWS_REGION` → `us-east-1` (or your region)
   - `AWS_S3_BUCKET` → Your bucket name

5. For Slack notifications (optional):
   - `SLACK_WEBHOOK` → https://hooks.slack.com/services/YOUR/WEBHOOK

6. Test: Go to Actions tab → "Weekly Database Export" → "Run workflow"

✅ **Done!** It will run automatically every Monday at 2 AM UTC.

---

#### 🎯 Setup Path B: Vercel Cron + Backend

**Time: 15 minutes**

##### Step 1: Backend Setup (Railway/Render)

**On Railway or Render:**

1. Create backend service (if not exists)
2. Add environment variables:
   ```
   DATABASE_URL = postgresql://...
   EXPORT_API_KEY = [your-api-key-from-step-2]
   EXPORT_DIR = /tmp/exports (or persistent disk path)
   NODE_ENV = production
   ```

3. Deploy code (includes new export routes)

4. Get backend URL:
   - Railway: `https://your-project-name.railway.app`
   - Render: `https://your-service-name.onrender.com`

##### Step 2: Vercel Setup

1. Go to Vercel project settings
2. Environment Variables → Add:
   ```
   BACKEND_URL = https://your-backend.railway.app
   EXPORT_API_KEY = [same-key-as-backend]
   CRON_SECRET = [generate-random-secret]
   ```

3. Redeploy project

✅ **Done!** Cron will run Monday 2 AM UTC.

---

#### 🎯 Setup Path C: Manual CLI (Testing)

**Time: 0 minutes (already works)**

```bash
# List available commands
npm run export:manage -- help

# Trigger export
npm run export:manage -- trigger

# Check status
npm run export:manage -- status export-1712090400000

# List recent exports
npm run export:manage -- list
```

No setup needed! 🎉

---

### Setup Phase 3: Add Optional Features

#### 📦 S3 Storage (Optional)

Automatically upload exports to S3 for long-term storage:

1. Get AWS credentials from your AWS account
2. Create S3 bucket: `my-blog-backups` (or similar)
3. Set environment variables:
   ```
   AWS_ACCESS_KEY_ID = your-key
   AWS_SECRET_ACCESS_KEY = your-secret
   AWS_REGION = us-east-1
   AWS_S3_BUCKET = my-blog-backups
   ```

4. Exports automatically upload to S3 with GLACIER storage class
5. Total cost per export: ~$0.02-0.05 (very cheap!)

---

#### 🔔 Slack Notifications (Optional)

Get alerts when exports complete or fail:

1. Go to your Slack workspace
2. Create Incoming Webhook:
   - Browse: https://api.slack.com/apps
   - Create New App → From scratch
   - App Name: "Database Export"
   - Add features: Incoming Webhooks
   - Create New Webhook for channel: #notifications (or your choice)
   - Copy webhook URL

3. Set environment variable:
   ```
   SLACK_WEBHOOK = https://hooks.slack.com/services/YOUR/WEBHOOK
   ```

4. You'll get notifications every export! 📢

---

## ✅ Verification Checklist

After setup, verify everything works:

### For GitHub Actions:
- [ ] Secrets added to GitHub
- [ ] Run workflow manually: Works?
- [ ] Check logs: Any errors?
- [ ] Next Monday: Verify auto-run

### For Vercel Cron:
- [ ] Environment variables set on Vercel
- [ ] Environment variables set on backend
- [ ] Backend deployed
- [ ] Cron appears in Vercel deployments
- [ ] Backend has export routes (`/api/admin/export`)

### For Manual CLI:
- [ ] `EXPORT_API_KEY` environment variable set
- [ ] `BACKEND_URL` environment variable set (if using backend)
- [ ] `npm run export:manage -- list` works
- [ ] Can trigger: `npm run export:manage -- trigger`

### General:
- [ ] Database connection works (test with `--dry-run`)
- [ ] S3 credentials work (if enabled)
- [ ] Slack webhook works (if enabled)
- [ ] Export files appear in storage
- [ ] No critical errors in logs

---

## 🧪 Testing Commands

Run these to verify your setup:

```bash
# Test 1: Check database connection
npm run export:weekly -- --dry-run

# Test 2: Trigger via CLI (if backend setup)
npm run export:manage -- trigger --dry-run

# Test 3: Check status
npm run export:manage -- status <jobId-from-test-2>

# Test 4: List exports
npm run export:manage -- list

# Test 5: Manual export (local)
VERBOSE=true npm run export:weekly
```

---

## 🐛 Troubleshooting

### "Database connection failed"
```bash
# Check connection string
echo $DATABASE_URL
# If empty, set it:
export DATABASE_URL="postgresql://..."

# Test connection
npm run export:weekly -- --dry-run
```

### "API key not set"
```bash
# For backend API calls
export EXPORT_API_KEY="your-api-key"

# For Vercel/CLI
export BACKEND_URL="https://your-backend.railway.app"
export EXPORT_API_KEY="your-api-key"
```

### "Cron not working"
1. Check Vercel deployment logs
2. Verify `CRON_SECRET` is set
3. Test endpoint manually:
   ```bash
   curl -X POST https://yourdomain.com/api/cron/export \
     -H "authorization: Bearer your-cron-secret"
   ```

### "S3 upload fails"
1. Check AWS credentials
2. Verify bucket exists
3. Ensure bucket is writable
4. Check region matches

### "Slack notification fails"
1. Copy webhook URL exactly (no leading/trailing spaces)
2. Test webhook manually
3. Try different channel

---

## 📖 Documentation Reference

| Document | Use When |
|----------|----------|
| `EXPORT_QUICK_REFERENCE.md` | Quick lookup, command reference |
| `EXPORT_SYSTEM_SETUP.md` | Need complete setup guide |
| `EXPORT_PLATFORM_SETUP.md` | Setup for specific platform |
| `EXPORT_IMPLEMENTATION.md` | Want to understand architecture |

---

## 🎯 Expected Behavior

### GitHub Actions
- ✅ Runs automatically Monday 2 AM UTC
- ✅ Exports database (SQL + CSV)
- ✅ Uploads to S3 (if configured)
- ✅ Sends Slack notification (if configured)
- ✅ Stores artifacts 90 days
- ✅ Cleans up local old exports automatically

### Vercel Cron
- ✅ Runs automatically Monday 2 AM UTC
- ✅ Calls backend API
- ✅ Backend exports database
- ✅ Backend handles S3/Slack
- ✅ Returns status to Vercel logs

### Manual CLI
- ✅ Immediate execution
- ✅ Blocking (waits for completion)
- ✅ Shows progress in real-time
- ✅ Returns status on completion

---

## 💾 Storage Locations

After first export, you'll find files in:

```
Local:     ./exports/export-*.sql.gz, export-*.csv.tar.gz
S3:        s3://bucket/database-exports/weekly/export-*.sql.gz
GitHub:    Actions → Artifacts (90-day retention)
Backend:   $EXPORT_DIR (or /tmp/exports)
```

---

## 🔄 Next Steps After Setup

1. **Monitor first export:** Watch logs to ensure it works
2. **Verify storage:** Check S3 bucket or local exports folder
3. **Test restoration:** Verify exported files can be restored
4. **Set up alerts:** Enable Slack notifications
5. **Document credentials:** Store API keys securely
6. **Schedule review:** Monthly check that exports are working

---

## 🆘 Need Help?

1. **Quick issues?** → See troubleshooting section above
2. **Setup questions?** → Check `EXPORT_PLATFORM_SETUP.md`
3. **How it works?** → Read `EXPORT_IMPLEMENTATION.md`
4. **Command reference?** → Use `EXPORT_QUICK_REFERENCE.md`
5. **Full details?** → See `EXPORT_SYSTEM_SETUP.md`

---

## ✨ After Setup

Once everything is working:

- 🚀 **Set it and forget it** - exports run automatically
- 📊 **Monitor** - check logs occasionally
- 📈 **Scale** - if exports get huge, adjust retention policy
- 💰 **Optimize** - enable GLACIER storage for cost savings
- 🔐 **Secure** - rotate API keys periodically

**You now have automated database backups! 🎉**

---

## 📝 Notes

- First export may take longer (not optimized yet)
- Export files are compressed automatically
- Old exports cleaned up automatically (4-week retention)
- S3 storage transitions to GLACIER automatically (30 days)
- All operations logged for debugging

---

**Questions?** See the documentation files or check GitHub Issues.
