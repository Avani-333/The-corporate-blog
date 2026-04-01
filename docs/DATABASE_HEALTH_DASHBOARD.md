# Database Health Dashboard

## Overview

The Database Health Dashboard provides real-time monitoring of PostgreSQL database performance, capacity, and health. It includes comprehensive metrics, alerting, and historical tracking for production support.

## Accessing the Dashboard

### Admin Dashboard
```
Frontend: http://localhost:3000/admin/dashboard/health
Requires: Admin authentication
```

### API Endpoints
```
Base URL: http://localhost:3000/api/dashboard

All endpoints are protected and should be accessed via internal networks or with API keys in production.
```

## API Reference

### Dashboard Overview
```bash
GET /api/dashboard
```

Returns comprehensive dashboard data with all metrics.

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2024-03-20T12:00:00Z",
  "metricsAge": 5000,
  "summary": {
    "connections": {
      "active": 15,
      "percent": 15.0
    },
    "storage": {
      "percent": 45.2,
      "status": "normal|warning|critical"
    },
    "performance": {
      "cacheHitRatio": 92.5,
      "qps": 125.3
    },
    "backup": {
      "lastBackup": "2024-03-19T02:00:00Z",
      "status": "success|failed"
    }
  },
  "details": { ...full metrics... },
  "alerts": [ ...active alerts... ]
}
```

---

### Health Overview
```bash
GET /api/dashboard/overview
```

Lightweight endpoint for load balancers and health checks.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T12:00:00Z",
  "uptime": 172800,
  "alerts": 0
}
```

---

### Connection Metrics
```bash
GET /api/dashboard/connections
```

Detailed connection pool and concurrency metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T12:00:00Z",
  "connections": {
    "active": 15,
    "idle": 8,
    "idleInTransaction": 2,
    "waitingForLock": 0,
    "total": 25,
    "maxConnections": 100,
    "percentUsed": 25.0,
    "responseTime": "45ms"
  },
  "health": "healthy|warning"
}
```

**Metrics Explained:**
- **active**: Currently executing queries
- **idle**: Idle connections in pool
- **idleInTransaction**: Idle but in a transaction (potential locks)
- **percentUsed**: Pool utilization percentage
- **health**: healthy if < 70%, warning if 70-80%, critical if > 80%

---

### Performance Metrics
```bash
GET /api/dashboard/performance
```

Query performance and execution metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T12:00:00Z",
  "performance": {
    "queriesPerSecond": 125.3,
    "averageQueryTime": "2.5ms",
    "longestQuery": "523.4ms",
    "cacheHitRatio": "92.5%",
    "indexScans": 48532,
    "sequentialScans": 234,
    "seqVsIndexRatio": "0.005"
  },
  "slowQueries": [
    {
      "query": "SELECT * FROM posts WHERE...",
      "calls": 234,
      "averageTime": "125.3ms",
      "totalTime": "29s"
    }
  ]
}
```

**Metrics Explained:**
- **cacheHitRatio**: % of read requests served from cache (target: > 95%)
- **seqVsIndexRatio**: Sequential vs index scans ratio (lower is better)
- **slowQueries**: Top 5 slowest queries

---

### Storage Metrics
```bash
GET /api/dashboard/storage
```

Database size and table-level metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T12:00:00Z",
  "storage": {
    "totalSize": "2.5GB",
    "totalSizeBytes": 2684354560,
    "usedSize": "1.8GB",
    "percentUsed": 72.0,
    "health": "healthy|warning|critical"
  },
  "tables": {
    "count": 45,
    "estimatedRows": 5234567,
    "topBySize": [
      {
        "name": "public.posts",
        "size": "512MB",
        "sizeBytes": 536870912,
        "rows": 1234567,
        "lastVacuumed": "2024-03-20T08:00:00Z"
      }
    ]
  }
}
```

**Health Thresholds:**
- healthy: < 70%
- warning: 70-85%
- critical: > 85%

---

### Backup Metrics
```bash
GET /api/dashboard/backup
```

Backup status and recovery information.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T12:00:00Z",
  "backup": {
    "lastBackup": "2024-03-19T02:00:00Z",
    "lastBackupStatus": "success|failed|pending",
    "backupSize": "500MB",
    "nextScheduledBackup": "2024-03-26T02:00:00Z",
    "pointInTimeRecoveryAvailable": true,
    "retentionDays": 30,
    "timeSinceBackup": "24 hours ago",
    "health": "healthy|warning|critical"
  }
}
```

**Health Thresholds:**
- healthy: Backup successful within last 24 hours
- warning: Backup > 24 hours old
- critical: Backup failed or very old

---

### Alerts
```bash
GET /api/dashboard/alerts
```

Active alerts and issues.

**Response:**
```json
{
  "status": "degraded",
  "timestamp": "2024-03-20T12:00:00Z",
  "summary": {
    "total": 2,
    "critical": 0,
    "warning": 1,
    "info": 1
  },
  "alerts": [
    {
      "id": "storage_high",
      "severity": "warning",
      "type": "storage",
      "message": "Database storage usage: 72.5%",
      "timestamp": "2024-03-20T10:30:00Z",
      "resolved": false
    },
    {
      "id": "cache_hit_low",
      "severity": "info",
      "type": "performance",
      "message": "Cache hit ratio: 87.2%",
      "timestamp": "2024-03-20T11:00:00Z",
      "resolved": false
    }
  ]
}
```

---

### Force Refresh
```bash
GET /api/dashboard/refresh
```

Force immediate metrics update (bypasses cache).

**Response:**
```json
{
  "status": "success",
  "message": "Metrics refreshed",
  "timestamp": "2024-03-20T12:00:00Z",
  "nextAutoRefresh": "2024-03-20T12:00:30Z",
  "healthStatus": "healthy"
}
```

---

### Export Metrics
```bash
GET /api/dashboard/export?format=json|csv
```

Export metrics for analysis or backup.

**JSON Format:**
```json
{
  "exportedAt": "2024-03-20T12:00:00Z",
  "metrics": { ...full dashboard data... }
}
```

**CSV Format:**
```csv
Metric,Value
Status,healthy
Timestamp,2024-03-20T12:00:00Z
Active Connections,15
Connection Usage,15.0%
...
```

---

## Alert Types & Thresholds

### Connection Pool Alerts

| Condition | Severity | Message |
|-----------|----------|---------|
| Usage > 80% | WARNING | Connection pool usage high |
| Usage > 95% | CRITICAL | Connection pool exhausted |

### Storage Alerts

| Condition | Severity | Message |
|-----------|----------|---------|
| Usage > 70% | INFO | Monitor storage usage |
| Usage > 85% | WARNING | Storage capacity warning |
| Usage > 95% | CRITICAL | Storage capacity critical |

### Performance Alerts

| Condition | Severity | Message |
|-----------|----------|---------|
| Cache Hit < 80% | INFO | Cache efficiency degraded |
| Cache Hit < 70% | WARNING | Cache efficiency critical |
| Query Time > 1000ms | WARNING | Slow query detected |

### Backup Alerts

| Condition | Severity | Message |
|-----------|----------|---------|
| No backup > 24h | WARNING | Backup overdue |
| Backup Failed | CRITICAL | Backup operation failed |

---

## Dashboard Components

### Overview Card
Shows overall health status with color-coded indicator:
- ✅ **Green (Healthy)**: All metrics within normal range
- 🟡 **Yellow (Degraded)**: Some warnings, operational
- 🔴 **Red (Unhealthy)**: Critical issues detected

### Quick Stats
Four key metrics at a glance:
1. **Connections**: Active connections and pool utilization
2. **Storage**: Disk usage percentage
3. **Performance**: Cache hit ratio and QPS
4. **Backup**: Last backup status and time

### Alerts Panel
Shows active alerts sorted by severity:
- 🔴 Critical (requires immediate action)
- 🟡 Warning (needs attention)
- ℹ️ Info (for awareness)

### Top Tables
Shows largest tables by size with:
- Table name
- Size in human-readable format
- Estimated row count
- Last vacuum/analyze time

### Slow Queries
Top 5 slowest queries with:
- Partial query text
- Execution count
- Average execution time
- Total execution time

---

## Monitoring & Alerting

### Frontend Auto-Refresh
- Default: 30 seconds
- Configurable: toggle "Auto Refresh" checkbox
- Interval: Select custom interval in settings

### Slack Integration
To enable Slack notifications for critical alerts:

```bash
# Set webhook URL in environment
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Alerts will be posted to associated channel
```

### Email Alerts
For email notifications, configure in backend:

```javascript
// In services/alertManager.ts
notifications: {
  email: true,
  recipients: ['ops@example.com'],
  severity: ['critical', 'warning']
}
```

### PagerDuty Integration
To integrate with PagerDuty for on-call escalation:

```bash
PAGERDUTY_INTEGRATION_KEY=your-key-here
PAGERDUTY_SERVICE_ID=your-service-id

# Critical alerts will trigger incidents
```

---

## Recommended Response Actions

### Connection Pool Pressure (> 80%)
```bash
1. Check for long-running queries
   npm run db:slow-queries

2. Terminate idle connections
   psql -d $DB_URL -c "
     SELECT pg_terminate_backend(pid) 
     FROM pg_stat_activity 
     WHERE state = 'idle' AND 
     state_change < now() - interval '10 minutes';"

3. Scale up connections (if applicable)
   # Modify pool settings in config
   MAX_CONNECTIONS=150

4. Review and optimize queries
   npm run db:analyze
```

### Storage Capacity (> 85%)
```bash
1. Identify largest tables
   # Check Top Tables in dashboard

2. Archive old data
   # Move posts older than 2 years to archive table

3. VACUUM and ANALYZE
   npm run db:maintenance

4. Increase disk size
   # Contact infrastructure team or cloud provider
```

### Cache Hit Ratio Low (< 85%)
```bash
1. Check cache settings
   psql -d $DB_URL -c "SHOW shared_buffers;"

2. Analyze slow queries
   # Check Slow Queries panel

3. Add/optimize indexes
   npm run db:analyze-indexes

4. Monitor for sequential table scans
   # Check seqVsIndex ratio
```

### Backup Failure
```bash
1. Check backup logs
   tail -f logs/backup.log

2. Verify storage availability
   df -h /backups

3. Test backup process
   npm run migrate:backup

4. Verify S3 credentials
   aws s3 ls

5. Alert DevOps team
   # Post to #incidents channel
```

---

## Troubleshooting

### Dashboard Shows "Unhealthy" But Services Are Working
- Metrics may be stale, click "Refresh Now"
- Check if database connection is responsive
- Verify health monitor service is running

### Missing Slow Queries Data
- pg_stat_statements extension may not be enabled
- Query: `SELECT * FROM pg_available_extensions WHERE name = 'pg_stat_statements';`
- Enable: `CREATE EXTENSION pg_stat_statements;`

### Backup Metrics Not Updating
- Verify backup cron job is configured
- Check backup script permissions
- Review logs: `tail logs/export-*.log`

### Connection Count Seems Incorrect
- Replication connections may be included
- Filter by current database connection
- Check pool vs actual database connections

### High Cache Misses
- Database may be larger than available memory
- Increase shared_buffers if possible
- Review missing indexes for hot queries
- Consider read replicas for read scaling

---

## Performance Optimization Tips

### Based on Cache Hit Ratio
- **Current**: Your % cache hits
- **Target**: > 95% for optimal performance
- **Action**: If < 90%, review top queries and add indexes

### Based on Slow Query Analysis
1. Check if slow queries are using optimal indexes
2. Analyze query plans: `EXPLAIN ANALYZE <query>`
3. Add missing indexes for frequently filtered columns
4. Consider query rewriting if sequential scans are involved

### Based on Connection Usage
- If consistently > 50%, consider read replicas
- Implement connection pooling at application level
- Review idle transactions and close them
- Monitor and limit long-running operations

---

## API Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Metrics successful |
| 503 | Service Unavailable | Metrics not yet ready, retry |
| 403 | Forbidden | Authentication/authorization issue |
| 500 | Server Error | Backend error, check logs |

---

## Integration Examples

### cURL
```bash
# Get dashboard overview
curl http://localhost:3000/api/dashboard

# Get only connections
curl http://localhost:3000/api/dashboard/connections

# Force refresh
curl http://localhost:3000/api/dashboard/refresh

# Export as CSV
curl http://localhost:3000/api/dashboard/export?format=csv > metrics.csv
```

### Node.js/fetch
```javascript
async function getMetrics() {
  const response = await fetch('/api/dashboard');
  const metrics = await response.json();
  console.log(`Database Status: ${metrics.status}`);
  console.log(`Connections: ${metrics.summary.connections.active}/${metrics.summary.connections.total}`);
}

getMetrics();
```

### Python
```python
import requests

response = requests.get('http://localhost:3000/api/dashboard')
metrics = response.json()

print(f"Status: {metrics['status']}")
print(f"Cache Hit Ratio: {metrics['summary']['performance']['cacheHitRatio']}%")
```

---

## Best Practices

### Monitoring
1. ✅ Check dashboard daily
2. ✅ Set up alert notifications
3. ✅ Review trends weekly
4. ✅ Capacity plan monthly

### Maintenance
1. ✅ Run VACUUM weekly
2. ✅ Analyze statistics daily
3. ✅ Reindex periodically
4. ✅ Archive old data monthly

### Performance
1. ✅ Keep cache hit ratio > 95%
2. ✅ Maintain < 3:1 seq:index scan ratio
3. ✅ Slow queries should be < 100ms avg
4. ✅ Connection pool usage < 70%

### Backup
1. ✅ Verify backup completes daily
2. ✅ Test restore monthly
3. ✅ Keep 30+ days retention
4. ✅ Alert on backup failures

---

## Further Reading

- [PostgreSQL Monitoring](https://www.postgresql.org/docs/current/monitoring.html)
- [Query Performance](https://www.postgresql.org/docs/current/sql-explain.html)
- [Neon Documentation](https://neon.tech/docs)
- [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)

---

**Last Updated**: March 2024
**Maintained By**: Database Administration Team
**Review Frequency**: Quarterly
