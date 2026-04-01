# Load Testing Commands

## Prerequisites

```bash
# Install k6
# macOS
brew install k6

# Linux
apt-get install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

## Run All Load Tests

```bash
# Make script executable
chmod +x scripts/load-test/run-load-tests.sh

# Run all tests (recommended)
./scripts/load-test/run-load-tests.sh

# Or with custom base URL
LOAD_TEST_URL=https://yourdomain.com ./scripts/load-test/run-load-tests.sh
```

---

## Run Individual Tests

### 1. Sustained Load Test (2,000 Concurrent Users)

```bash
# 15-minute test ramping from 100 to 2,000 users
k6 run --vus 100 --duration 15m scripts/load-test/load-test.ts

# Or with environment variable
K6_SCENARIO=sustained-load-2k-users k6 run scripts/load-test/load-test.ts
```

**What it measures:**
- Response time at 50th, 75th, 90th, 95th, 99th percentiles
- Cold start latency (initial spike)
- Error rate under sustained load
- Database connection growth
- Memory usage and spike detection

**Expected metrics:**
- P95: < 500ms
- P99: < 1000ms
- Error rate: < 10%
- Max DB connections: < 25

---

### 2. Publish Burst Test

```bash
# Simulate 500 editors publishing simultaneously
K6_SCENARIO=publish-burst k6 run scripts/load-test/load-test.ts

# Or with options
k6 run \
  --vus 500 \
  --duration 40s \
  scripts/load-test/load-test.ts
```

**What it measures:**
- Concurrent write performance
- Publish success/failure rate
- Database lock contention
- Memory pressure during writes
- ISR cache invalidation performance

**Expected metrics:**
- Publish success rate: > 95%
- P95 publish time: < 800ms
- No timeouts or deadlocks

---

### 3. Search Burst Test

```bash
# Simulate 300 users searching simultaneously
K6_SCENARIO=search-burst k6 run scripts/load-test/load-test.ts

# Or custom duration
k6 run \
  --vus 300 \
  --duration 1m \
  scripts/load-test/load-test.ts
```

**What it measures:**
- Search query performance
- Search index performance
- Cache hit rate for search results
- Full-text search latency
- Concurrent search database load

**Expected metrics:**
- P95 search: < 300ms
- Cache hit rate: > 50%
- Error rate: < 5%

---

### 4. Cold Start Test

```bash
# Immediate spike to 1,000 users from zero
K6_SCENARIO=cold-start k6 run scripts/load-test/load-test.ts
```

**What it measures:**
- Initial request latency (server startup)
- Ramp-up to handle load
- Connection pool initialization
- Database warmup time
- First request experience

**Expected metrics:**
- First request: < 2 seconds
- Stabilization: < 10 seconds
- P95 after stabilization: < 500ms

---

## Advanced Options

### Output JSON Report

```bash
k6 run \
  --out json=results.json \
  --summary-export=summary.json \
  scripts/load-test/load-test.ts
```

### With Influxdb/Grafana

```bash
# Send metrics to InfluxDB for real-time dashboards
k6 run \
  --out influxdb=http://localhost:8086/k6 \
  scripts/load-test/load-test.ts
```

### Custom VUs and Duration

```bash
# 3,000 concurrent users for 10 minutes
k6 run \
  --vus 3000 \
  --duration 10m \
  scripts/load-test/load-test.ts

# Ramp pattern (2 min ramp-up, 5 min sustain, 2 min ramp-down)
k6 run \
  --stage 2m:100 \
  --stage 5m:3000 \
  --stage 2m:0 \
  scripts/load-test/load-test.ts
```

---

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| P95 Response | < 500ms | > 1000ms |
| P99 Response | < 1000ms | > 2000ms |
| Error Rate | < 1% | > 10% |
| DB Connections | < 20 | > 25 |
| Memory Usage | < 500MB | > 1000MB |
| Cache Hit Rate | > 70% | < 50% |

---

## Monitoring Metrics

The load test captures these metrics:

### Response Time
```
http_req_duration      - Overall response time
response_time_p50      - Median (50th percentile)
response_time_p95      - P95 percentile
response_time_p99      - P99 percentile
```

### Reliability
```
error_rate             - Percentage of failed requests
http_req_failed        - Count of failed requests
http_req_success       - Count of successful requests
```

### Database
```
db_connections_total   - Total database connections
db_connections_active  - Active executing queries
db_connections_idle    - Idle waiting connections
db_connection_wait_time - Time waiting for available connection
```

### Memory
```
memory_heap_used_mb    - JavaScript heap used
memory_heap_total_mb   - JavaScript heap total
memory_external_mb     - External memory (native)
memory_rss_mb          - Resident set size
memory_spike_peak_mb   - Peak memory during spike
```

### Business
```
publish_operations     - Number of publish operations
publish_success        - Successful publishes
publish_errors         - Failed publishes
search_queries         - Number of search queries
read_operations        - Read operations count
cache_hit_rate         - Percentage of cache hits
```

---

## Analyzing Results

### View Summary

```bash
# Display test summary
k6 run --summary-export=summary.json scripts/load-test/load-test.ts
cat summary.json
```

### Generate Graphs

```bash
# k6 doesn't generate graphs, but JSON output can be visualized with:
# - k6 cloud (https://cloud.k6.io)
# - Grafana + InfluxDB
# - Custom scripts
```

### Compare Runs

```bash
# Run test 1
k6 run --out json=run1.json scripts/load-test/load-test.ts

# Run test 2
k6 run --out json=run2.json scripts/load-test/load-test.ts

# Compare (requires custom analysis script)
node scripts/load-test/analyze-results.js run1.json run2.json
```

---

## Troubleshooting

### Too Many Open Files

```bash
# Increase file descriptor limit
ulimit -n 65535

# Verify
ulimit -n
```

### Database Connection Timeout

```bash
# Check max connections
psql -l | grep connections

# Increase if needed in postgresql.conf
max_connections = 200
```

### Out of Memory

```bash
# Reduce concurrent users
k6 run --vus 500 scripts/load-test/load-test.ts

# Or use memory-efficient mode
K6_MEMORY_MODE=lite k6 run scripts/load-test/load-test.ts
```

### Tests Not Running

```bash
# Verify k6 installation
k6 version

# Check test file syntax
k6 inspect scripts/load-test/load-test.ts

# Run with debug output
k6 run --loglevel=debug scripts/load-test/load-test.ts
```

---

## Sample Results

Typical output from sustained load test:

```
     ✓ post loads successfully
       → 98% success rate
     ✓ page loads
       → 99% success rate

     checks.........................: 98.51% ✓ 1234 ✗ 18
     data_received..................: 45 MB  150 kB/s
     data_sent.......................: 12 MB  40 kB/s
     dropped_iterations.............: 0     0/s
     http_req_duration..............: avg=245ms   min=10ms   med=120ms   max=5.2s  p(90)=580ms p(95)=750ms p(99)=1.2s
     http_req_failed................: 1.49%  ✓ 18 ✗ 1234
     http_reqs.......................: 1234   41/s
     iterations.....................: 1234   41/s

     running (00m30.1s), 0000/2000 VUs, 1234 complete and 0 interrupted iterations
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Tests

on: [push]

jobs:
  load-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres

    steps:
      - uses: actions/checkout@v2
      
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run load tests
        run: ./scripts/load-test/run-load-tests.sh
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: load-test-results
          path: load-test-results/
```

---

## Next Steps

1. **Run baseline**: Execute all tests to establish baseline metrics
2. **Monitor**: Watch DB connections and memory during tests
3. **Analyze**: Compare results vs targets
4. **Optimize**: Address bottlenecks (DB indexes, caching, scaling)
5. **Retest**: Run again to verify improvements

---

## Resources

- k6 Documentation: https://k6.io/docs/
- Performance Testing Guide: https://k6.io/docs/testing-guides/
- Best Practices: https://k6.io/blog/best-practices/
- Community Scripts: https://github.com/grafana/k6/tree/master/samples

