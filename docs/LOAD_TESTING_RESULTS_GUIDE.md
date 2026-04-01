# Load Test Results Interpretation Guide

## Test Scenarios Explained

### 1. Sustained Load Test (2,000 Concurrent Users)

**What it simulates:** Production traffic volume ramping up over time, peaking at 2,000 users.

**Timeline:**
```
0-1min:   100 users (ramp up)
1-3min:   500 users
3-6min:   1,000 users
6-11min:  2,000 users (peak)
11-14min: 1,000 users (ramp down)
14-15min: 0 users
```

**Key metrics to watch:**
- **P95/P99 response times** - Should remain stable during peak
- **Memory usage** - Steady climb, no sudden spikes
- **DB connections** - Gradual increase, returns to baseline
- **Cache hit ratio** - Should stabilize as cache warms up

**Success criteria:**
- P95 < 500ms throughout
- P99 < 1000ms at peak
- Connections < 25 max
- Memory growth < 30% from baseline

---

### 2. Publish Burst Test

**What it simulates:** Editors simultaneously publishing content (flash mob scenario).

**Profile:**
```
0-30s:   Baseline (0 publishers)
30-40s:  500 concurrent publish operations
40-70s:  Sustained at 500 publishers
70-80s:  Drop to 0
```

**Measures:**
- Write performance under stress
- Database lock contention
- Cache invalidation overhead
- Transaction rollback handling

**Key metrics:**
- **Publish success rate** - Should be > 95%
- **P95 publish latency** - Target < 800ms
- **Error responses** - Should be near 0% (no timeouts)
- **DB lock waits** - Minimal stalling

**Success criteria:**
- Success rate > 95%
- No timeout errors
- Database doesn't deadlock

---

### 3. Search Burst Test  

**What it simulates:** Popular article trending, driving search volume spike.

**Profile:**
```
0-30s:   Baseline search traffic
30-40s:  Jump to 300 concurrent searches
40-85s:  Sustained at 300 searches
85-95s:  Drop to 0
```

**Measures:**
- Full-text search performance
- Index efficiency
- Cache effectiveness for search results
- Database query optimization

**Key metrics:**
- **Average search latency** - Target < 300ms
- **P95 search latency** - Target < 500ms
- **Cache hit ratio** - Should be > 50-70% after warmup
- **Query load on DB** - Spread across cluster

**Success criteria:**
- < 300ms average
- Cache hit ratio improves each search
- No query timeouts

---

### 4. Cold Start Test

**What it simulates:** Application restart or new instance coming online during traffic surge.

**Profile:**
```
0-5s:    Sudden spike to 1,000 users
5-40s:   Sustained 1,000 users
40-45s:  Drop to 0
```

**Measures:**
- Server startup latency
- Connection pool initialization
- Database warmup time
- Cache rebuild time

**Key metrics:**
- **First response latency** - How long before server responds
- **Stabilization time** - How long until normal performance
- **Memory ramp-up** - Connection pool, cache startup overhead
- **P95 after stabilization** - What latency after warm

**Success criteria:**
- First request < 2 seconds
- Stabilization in < 10 seconds
- P95 returns to normal quickly

---

## Metric Deep Dive

### Response Time Percentiles

```
Avg:   245ms  ← Average of all requests
P50:   120ms  ← Median (50% of requests faster)
P90:   400ms  ← 90% of requests faster than this
P95:   750ms  ← 95% of requests faster than this
P99:   1200ms ← 99% of requests faster than this
```

**Target hierarchy:**
- 50%+ requests: < 100ms (excellent)
- 90%+ requests: < 300ms (good)
- 95%+ requests: < 500ms (acceptable)
- 99%+ requests: < 1000ms (warning)

**Example good result:**
```
http_req_duration: avg=245ms, p(50)=120ms, p(90)=320ms, p(95)=480ms, p(99)=950ms
Status: ✓ PASS
```

**Example problematic result:**
```
http_req_duration: avg=600ms, p(50)=450ms, p(90)=980ms, p(95)=1400ms, p(99)=2100ms
Status: ✗ FAIL - Too slow
```

---

### Error Rate

**Calculation:** (Failed Requests / Total Requests) × 100

**Thresholds:**
- < 0.1% - Excellent
- 0.1 - 1% - Good
- 1 - 5% - Warning (investigate)
- 5 - 10% - Critical
- > 10% - Failure

**Example:**
```
Total Requests: 50,000
Failed: 250
Error Rate: 250/50,000 = 0.5% ✓ GOOD
```

**Common error causes:**
- Timeout (request takes too long)
- 503 Service Unavailable (server overloaded)
- 500 Internal Server Error (application crash)
- Connection refused (database unavailable)

---

### Database Connections

**Metrics tracked:**

| Metric | Meaning | Target |
|--------|---------|--------|
| Total | All connections | < 25 |
| Active | Executing queries | < 10 |
| Idle | Waiting for commands | < 15 |
| Idle in Transaction | Locked connections | = 0 |

**Example output:**
```
Total Connections: 18/25 peak
Active Queries: 8 (peak 10)
Idle Connections: 10
Idle in Transaction: 0
Connection Wait Time: 0.5s max
```

**Interpretation:**
- 18 connections = 72% utilization (healthy)
- 0 idle in transaction = no deadlocks
- 0.5s wait = acceptable pool saturation

**Warning signs:**
- Total > 25: Connections maxed, requests queued
- Idle in Transaction > 0: Locks not released
- Wait time > 1s: Heavy contention

---

### Memory Usage

**Metrics:**
- **Heap Used** - Active JavaScript objects
- **Heap Total** - Reserved for JavaScript
- **RSS (Resident Set)** - Total memory used

**Example:**
```
Baseline:     250MB heap used
During Load:  400MB heap used  (+150MB, +60%)
Peak Spike:   480MB heap used  
Final:        350MB heap used (GC not aggressive)
```

**Interpretation:**
- 60% growth is normal under 2K user load
- > 80% growth = memory leak or inefficient algorithms
- Shouldn't return to baseline = "leaking" memory

**What causes spikes:**
- Connection pool creation
- Response caching
- Session storage
- Query result sets

---

### Cache Hit Ratio

**Formula:** Cache Hits / (Cache Hits + Cache Misses)

**Example:**
```
Hits: 4,500
Misses: 1,500
Ratio: 4500 / (4500 + 1500) = 75% ✓
```

**Good by product:**
- Homepage: > 90% (static content)
- Blog post: 70-90% (repeats same posts)
- Search: 50-70% (varied queries)
- API: 30-50% (dynamic content)

**Improving cache hit:**
1. Longer TTL for stable content
2. Warmup cache before test
3. Reduce cache keys (simplified queries)
4. CDN for static assets

---

## Real-World Result Examples

### Excellent Performance ✓

```
Response Times:
  avg: 180ms, p(95): 320ms, p(99): 650ms

Error Rate: 0.2%

Connections:
  total: 12/25, active: 5, idle: 7

Memory:
  peak: 380MB, growth: +45%

Cache:
  hit ratio: 72%

Status: ✓ PASS - Excellent results
```

### Acceptable Performance ✓

```
Response Times:
  avg: 350ms, p(95): 680ms, p(99): 1.2s

Error Rate: 0.8%

Connections:
  total: 22/25, active: 9, idle: 13

Memory:
  peak: 480MB, growth: +65%

Cache:
  hit ratio: 65%

Status: ✓ PASS - Meets requirements
```

### Performance Issues ⚠

```
Response Times:
  avg: 580ms, p(95): 1100ms, p(99): 2.1s

Error Rate: 3.2%

Connections:
  total: 25/25, active: 15, idle: 10

Memory:
  peak: 650MB, growth: +90%

Cache:
  hit ratio: 42%

Status: ⚠ WARNING - Investigate causes
```

### System Failure ✗

```
Response Times:
  avg: 2100ms, p(95): 4500ms, p(99): >10s

Error Rate: 15%

Connections:
  Connection pool exhausted, many timeouts

Memory:
  peak: 850MB+, leaking

Status: ✗ FAIL - Cannot handle target load
```

---

## Optimization Actions

### If P95 > 500ms

1. **Check database performance**
   ```bash
   # Find slow queries
   psql -c "SELECT query, calls, total_time, mean_time 
            FROM pg_stat_statements 
            ORDER BY mean_time DESC LIMIT 10"
   ```

2. **Add database indexes**
   ```bash
   # Analyze missing indexes
   psql -c "SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0"
   ```

3. **Enable query caching**
   - Implement Redis caching
   - Increase ISR revalidation time
   - Cache expensive computations

4. **Optimize query N+1**
   - Use JOINs instead of multiple queries
   - Batch operations

### If Error Rate > 1%

1. **Check application logs**
   ```bash
   # Find error patterns
   tail -100f logs/error.log
   ```

2. **Identify specific endpoints**
   - Which endpoints are failing?
   - What's the error message?

3. **Common causes**
   - Database connection pool exhausted
   - Memory running out
   - Deployment issues

### If Connections > 25

1. **Increase pool size** (if your DB allows)
   ```
   // prisma/schema.prisma
   datasource db {
     url = env("DATABASE_URL")
     pool = 30  // Increase from 20
   }
   ```

2. **Reduce connection leaks**
   - Ensure all queries properly close
   - Check for idle in transaction

3. **Connection reuse**
   - Use connection pooling (PgBouncer)
   - Reuse connections between requests

### If Memory Grows > 80%

1. **Enable aggressive GC**
   ```bash
   NODE_OPTIONS="--max-old-space-size=2048" npm start
   ```

2. **Find memory leaks**
   ```bash
   # Generate heap snapshot
   kill -USR2 <PID>
   ```

3. **Reduce cache sizes**
   - Set TTL on cached items
   - Limit cache entry count

---

## Regression Detection

### Compare Against Baseline

```bash
# Run test and save baseline
npm run load-test:sustained > baseline-run1.txt

# Run test after optimization 
npm run load-test:sustained > optimized-run1.txt

# Compare
diff baseline-run1.txt optimized-run1.txt
```

**Look for:**
- P95 improvement > 10%
- Error rate reduction
- Connection count decrease
- Memory stabilization

---

## Next Steps After Testing

1. **Document baseline** - Save successful test results
2. **Set monitoring alerts** - Alert if P95 exceeds baseline
3. **Plan optimizations** - Prioritize by biggest impact
4. **Retest after changes** - Verify improvements
5. **Load testing in CI/CD** - Catch regressions early

---

For more information, see:
- [LOAD_TESTING_GUIDE.md](LOAD_TESTING_GUIDE.md)
- [LOAD_TESTING_QUICKSTART.md](LOAD_TESTING_QUICKSTART.md)
- k6 Documentation: https://k6.io/docs/

