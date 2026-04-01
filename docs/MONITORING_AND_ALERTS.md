# Monitoring, Alerting, and Error Tracking Setup

Complete setup guide for Sentry integration, uptime monitoring, alert policies, and log retention in The Corporate Blog.

## Table of Contents

1. [Overview](#overview)
2. [Sentry Setup](#sentry-setup)
3. [Uptime Monitoring](#uptime-monitoring)
4. [Alert Policies](#alert-policies)
5. [Log Retention](#log-retention)
6. [Health Check Endpoints](#health-check-endpoints)
7. [Monitoring Dashboard](#monitoring-dashboard)
8. [Troubleshooting](#troubleshooting)

## Overview

The monitoring stack consists of:

- **Sentry**: Error tracking and performance monitoring (Frontend + Backend)
- **Uptime Monitor**: Health checks every 5 minutes
- **Alert Policies**: Automated alerting for errors, slow routes, and uptime degradation
- **Log Retention**: Automatic cleanup and archival of logs

## Sentry Setup

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create two projects:
   - **Frontend**: Select "Next.js"
   - **Backend**: Select "Node.js / Express"

### 2. Get Your DSN

After creating projects, you'll receive:
- `SENTRY_DSN` for backend
- `NEXT_PUBLIC_SENTRY_DSN` for frontend

### 3. Configure Environment Variables

**Backend (.env)**
```bash
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

**Frontend (.env.local)**
```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 4. Frontend Integration (Already Configured)

The frontend uses `@sentry/nextjs` which is configured in:

- **Initialization**: Added to providers and component error tracking
- **Configuration**: `lib/sentry-client.ts`
- **Integration**: Error tracking automatically captures exceptions

```tsx
import { captureException, setUserContext } from '@/lib/sentry-client';

// Track errors
try {
  // code
} catch (error) {
  captureException(error, { context: 'myFunction' });
}

// Set user context
setUserContext(userId, email, username);
```

### 5. Backend Integration (Already Configured)

The backend uses `@sentry/node` which is configured in:

- **Initialization**: `backend/src/config/sentry.ts`
- **Middleware**: Added to Express app in `app.ts`
- **Integration**: Error handling middleware captures exceptions

```typescript
import { captureException, addBreadcrumb } from '@/config/sentry';

// Track errors
try {
  // code
} catch (error) {
  captureException(error, { context: 'myFunction' });
}

// Add breadcrumbs
addBreadcrumb('Action performed', 'action', 'info', { data });
```

## Uptime Monitoring

### How It Works

- Performs health checks every **5 minutes**
- Checks database, Redis, and external services
- Tracks uptime percentage
- Automatically reports degradation

### Starting Uptime Monitor

The monitor starts automatically when the backend server starts:

```bash
npm run dev  # Starts uptime monitoring
```

### Status Indicators

- **✅ Healthy**: All checks pass
- **⚠️ Degraded**: Some checks fail (e.g., Redis unavailable)
- **❌ Unhealthy**: Critical service down (e.g., database)

### Metrics Tracked

```
- Total checks
- Successful checks
- Failed checks
- Uptime percentage
- Average response time
```

## Alert Policies

### Pre-configured Policies

1. **5xx Error Rate Alert**
   - Triggers when: Error rate > 5%
   - Window: 5 minutes
   - Actions: Email, Slack

2. **Slow Route Response Time Alert**
   - Triggers when: Response time > 1.5s
   - Window: 5 minutes
   - Actions: Email

3. **Uptime Degradation Alert**
   - Triggers when: Uptime < 99.5%
   - Window: 1 hour
   - Actions: Email, Slack

4. **High Error Throughput Alert**
   - Triggers when: Error requests > 100/min
   - Window: 1 minute
   - Actions: Email, Slack

### Configure Alerts

Set environment variables for alert actions:

```bash
# Email alerts
ALERT_EMAIL=ops@example.com

# Slack alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty (optional)
PAGERDUTY_KEY=your-pagerduty-key
```

### Managing Alert Policies

**List policies:**
```bash
GET /health/alerts/policies
```

**Enable specific policy:**
```bash
POST /health/alerts/error_rate_5xx/enable
```

**Disable specific policy:**
```bash
POST /health/alerts/error_rate_5xx/disable
```

### Adding Custom Policies

Edit `backend/src/services/alertPolicies.ts`:

```typescript
alertManager.addPolicy({
  id: 'custom_alert',
  name: 'Custom Alert',
  type: 'error_rate',
  condition: {
    metric: 'my_metric',
    operator: '>',
    threshold: 100,
  },
  // ... configuration
});
```

## Log Retention

### Default Policies

| Level | Retention | Size | Sampling |
|-------|-----------|------|----------|
| Error | 90 days | 5GB | None |
| Warn | 30 days | 2GB | None |
| Info | 14 days | 1GB | None |
| Debug | 3-7 days | 500MB | 10% (prod) |

### Configuration

Edit settings in `backend/src/services/logRetention.ts`:

```typescript
logRetention.updatePolicy('info', {
  retention: { days: 30, maxSizeMb: 2000 },
  archive: { enabled: true, format: 'gzip' },
  sampling: { enabled: false, rate: 1 }
});
```

### Environment Variables

```bash
# Log archive destination
LOG_ARCHIVE_DESTINATION=local  # or 's3', 'gcs'

# Log level
LOG_LEVEL=info
```

### Cleanup Schedule

- Automatic: Every 6 hours
- Manual trigger: `POST /health/logs/cleanup`

### Storage Usage

Get current storage stats:

```bash
GET /health/metrics
```

Response includes estimated storage by log level.

## Health Check Endpoints

### Basic Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T10:30:00Z"
}
```

### Detailed Health Status

```
GET /health/detailed
```

Includes:
- System uptime
- Uptime metrics
- Active alerts
- Log counts
- Environment info

### Raw Metrics

```
GET /health/metrics
```

Returns raw uptime metrics and log statistics.

### Recent Alerts

```
GET /health/alerts?limit=20
```

Get recent alert events with optional limit.

### Alert Policies Configuration

```
GET /health/alerts/policies
```

List all alert policies with status.

### Log Retention Policies

```
GET /health/logs/policies
```

List log retention policies.

## Monitoring Dashboard

### Creating a Monitoring Dashboard

Use these endpoints to build a monitoring dashboard:

**Dashboard Data Endpoint:**
```bash
GET /health/detailed
```

**Real-time Metrics:**
```bash
GET /health/metrics
```

Refresh every 30-60 seconds.

### Example Dashboard Layout

```
┌─────────────────────────────────────┐
│  System Health Overview             │
├─────────────────────────────────────┤
│                                     │
│  Status: ✅ HEALTHY                 │
│  Uptime: 99.9%                      │
│  Last Check: 2 min ago              │
│                                     │
├─────────────────────────────────────┤
│  Active Alerts                      │
│  • 0 Critical                       │
│  • 1 Warning                        │
│                                     │
├─────────────────────────────────────┤
│  Response Times (p95)               │
│  • API: 234ms                       │
│  • DB: 45ms                         │
│  • Overall: 280ms                   │
│                                     │
├─────────────────────────────────────┤
│  Error Rates (last 5 min)           │
│  • 5xx: 0.2%                        │
│  • 4xx: 1.5%                        │
│                                     │
└─────────────────────────────────────┘
```

## Integrations

### Slack Integration

1. Create Slack webhook in your workspace
2. Set `SLACK_WEBHOOK_URL` environment variable
3. Alerts automatically post to configured channel

### Email Integration

1. Configure SMTP settings:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=alerts@example.com
   FROM_NAME=TCB Alerts
   ```
2. Set `ALERT_EMAIL` environment variable

### PagerDuty Integration

1. Get PagerDuty integration key
2. Set `PAGERDUTY_KEY` environment variable
3. Add PagerDuty action to alert policies

## Troubleshooting

### Sentry Not Capturing Errors

**Backend:**
```bash
# Verify DSN is set
echo $SENTRY_DSN

# Check Sentry initialization in logs
# Look for: "✅ Sentry initialized for backend"
```

**Frontend:**
```bash
# Verify DSN is set
echo $NEXT_PUBLIC_SENTRY_DSN

# Check Sentry initialization in console
# Look for: "✅ Sentry initialized for frontend"
```

### Health Check Failing

```
GET /health/detailed
```

Check the response for individual component failures:
- `checks.database`
- `checks.redis`
- `checks.externalServices`

### Alerts Not Triggering

1. Check if policy is enabled: `GET /health/alerts/policies`
2. Verify webhook/email configuration
3. Check alert history: `GET /health/alerts`
4. Look for failed deliveries in Sentry

### High Log Storage Usage

1. Check current usage: `GET /health/metrics`
2. Reduce retention days in log retention policies
3. Increase sampling rate for debug logs
4. Manually trigger cleanup: `POST /health/logs/cleanup`

## Performance Considerations

### Sentry Performance Impact

- **Tracing overhead**: ~5-10% with 10% sample rate
- **Session replay**: Only enabled on errors in production
- **Breadcrumbs**: Limited to 50 per event

### Uptime Monitor Impact

- **Interval**: 5 minutes (minimal overhead)
- **Timeout**: 10 seconds per check
- **Memory**: ~1MB for metrics storage

### Log Retention Impact

- **Cleanup frequency**: Every 6 hours
- **Database queries**: Indexed by timestamp
- **Storage**: Configurable per log level

## Best Practices

### Error Tracking

✅ **Do:**
- Provide meaningful context with errors
- Use error levels appropriately (error vs. warning)
- Clean errors of sensitive information
- Set user context when available

❌ **Don't:**
- Log sensitive data (passwords, tokens)
- Track every non-error event
- Ignore 4xx client errors
- Create too many breadcrumbs

### Alerting

✅ **Do:**
- Set realistic thresholds
- Configure multiple alert actions
- Test alerts regularly
- Review and adjust after incidents

❌ **Don't:**
- Alert on every metric change
- Use overly sensitive conditions
- Ignore alert fatigue issues
- Set thresholds without baseline data

### Log Retention

✅ **Do:**
- Archive logs before deletion
- Keep error logs longer
- Use sampling for high-volume logs
- Monitor storage growth

❌ **Don't:**
- Delete logs without backup
- Keep debug logs in production
- Ignore compliance requirements
- Let storage grow unbounded

## Getting Help

- **Sentry Docs**: https://docs.sentry.io/
- **Issue Status**: https://status.sentry.io/
- **Support**: https://sentry.io/contact/support/

## See Also

- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Error boundary and client-side tracking
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment setup
- [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) - Infrastructure overview
