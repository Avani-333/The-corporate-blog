# Load Testing Quick Start Guide

## 30-Second Setup

```bash
# Make setup script executable
chmod +x scripts/load-test/setup.sh

# Run setup (installs k6 and verifies environment)
./scripts/load-test/setup.sh
```

## Run Load Tests

```bash
# Option 1: Run complete test suite (all scenarios)
npm run load-test

# Option 2: Run individual scenarios
npm run load-test:sustained    # 2,000 concurrent users (15 min)
npm run load-test:publish      # Publish burst (40 sec)
npm run load-test:search       # Search burst (55 sec)
npm run load-test:coldstart    # Cold start spike (20 sec)
```

## Monitor Database During Tests

```bash
# In another terminal, run database monitoring
node scripts/load-test/db-monitor.js
```

This displays in real-time:
- Total connections (peak tracking)
- Active executing queries
- Idle connections
- Cache hit ratio
- Query duration spikes

## View Results

```bash
# Analyze and print results
npm run load-test:analyze

# Or manually inspect JSON
cat load-test-results/*-summary.json | jq '.'
```

---

## What Gets Measured

| Metric | What | Target |
|--------|------|--------|
| **P95 Response** | 95th percentile latency | < 500ms |
| **P99 Response** | 99th percentile latency | < 1000ms |
| **Cold Start** | First request after startup | < 2000ms |
| **Error Rate** | Failed requests | < 1% |
| **DB Connections** | Active connections | < 20 |
| **Memory Spikes** | Heap growth > 15% | Detected |

---

## Understanding Results

Example output:
```
✓ post loads successfully -> 98% success
✓ page loads -> 99% success

http_req_duration..........: avg=245ms   P(95)=750ms P(99)=1.2s
error_rate................: 1.49%  
db_connections_active.....: 15
memory_spike_peak_mb......: 450mb
```

**Good results** ✓:
- P95 < 500ms
- Error rate < 1%
- DB connections < 20
- Memory stable

**Warning** ⚠:
- P95 500-1000ms
- Error rate 1-5%
- DB connections 20-25
- Memory spikes 15%+

**Problem** ✗:
- P95 > 1000ms
- Error rate > 5%
- DB connections > 25
- Timeouts/crashes

---

## Troubleshooting

### "Too many open files"
```bash
# Increase file descriptor limit
ulimit -n 65535
```

### "Database connection refused"
```bash
# Check database is running
psql $DATABASE_URL -c "SELECT 1"

# Or set DATABASE_URL before running
export DATABASE_URL="postgresql://user:pass@host/db"
```

### "k6 not found"
```bash
# Reinstall k6
./scripts/load-test/setup.sh

# Or manual install
# macOS: brew install k6
# Linux: apt-get install k6
# Windows: choco install k6
```

### "All requests failing"
```bash
# Check application is running
curl http://localhost:3000

# Check base URL is correct
LOAD_TEST_URL=http://localhost:3000 npm run load-test:sustained
```

---

## Example: Full Load Test Session

```bash
# 1. Start application
npm run dev &

# 2. Wait for startup
sleep 5

# 3. In second terminal, start DB monitoring
node scripts/load-test/db-monitor.js &

# 4. Run sustained load test
npm run load-test:sustained

# 5. View results
npm run load-test:analyze
```

---

## Performance Tuning Tips

If P95 > 500ms:

1. **Check cache hit rate** - Should be > 70%
   ```bash
   # Check logs for cache misses
   grep "MISS" logs/*.log
   ```

2. **Monitor slow queries** - Identify bottlenecks
   ```bash
   # Check PostgreSQL slow logs
   psql $DATABASE_URL -c "SELECT query_time, query FROM pg_stat_statements 
                           ORDER BY query_time DESC LIMIT 20"
   ```

3. **Database indexing** - Add missing indexes
   ```bash
   # Check index usage
   psql $DATABASE_URL -c "SELECT * FROM pg_stat_user_indexes"
   ```

4. **Connection pool** - Increase or optimize
   ```bash
   # In application, check connection pool settings
   grep -r "max.*connection" . --include="*.ts" --include="*.js"
   ```

---

## Next Steps

After first successful load test:

1. **Baseline** - Record current performance as baseline
2. **Threshold** - Set P95 target you want to achieve
3. **Optimize** - Implement changes (indexing, caching, etc)
4. **Retest** - Run again and compare
5. **Monitor** - Set up production monitoring

For detailed guide, see:
**[docs/LOAD_TESTING_GUIDE.md](../LOAD_TESTING_GUIDE.md)**

