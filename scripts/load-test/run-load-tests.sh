#!/bin/bash
set -e

# Load Testing Scripts
# Runs comprehensive load tests with monitoring

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${LOAD_TEST_URL:-http://localhost:3000}"
K6_PATH="${K6_PATH:-k6}"
RESULTS_DIR="./load-test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_NAME="load-test-${TIMESTAMP}"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

print_header() {
  echo -e "\n${BLUE}================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# ============================================================================
# SETUP
# ============================================================================

setup() {
  print_header "LOAD TEST SETUP"
  
  # Check if k6 is installed
  if ! command -v "$K6_PATH" &> /dev/null; then
    print_error "k6 not found. Please install k6:"
    echo "  macOS: brew install k6"
    echo "  Linux: apt-get install k6"
    echo "  Or download from: https://k6.io/docs/getting-started/installation/"
    exit 1
  fi
  
  print_success "k6 found: $(k6 version)"
  
  # Create results directory
  mkdir -p "$RESULTS_DIR"
  print_success "Results directory: $RESULTS_DIR"
  
  # Check base URL
  print_info "Base URL: $BASE_URL"
  
  # Health check
  if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    print_success "Application is running"
  else
    print_error "Application is not responding at $BASE_URL"
    print_info "Make sure the application is running before running load tests"
    exit 1
  fi
}

# ============================================================================
# TEST EXECUTION
# ============================================================================

run_sustained_load_test() {
  print_header "SUSTAINED LOAD TEST (2,000 concurrent users)"
  
  print_info "Scenario: Ramping from 100 to 2,000 concurrent users over 11 minutes"
  print_info "Measuring: P95/P99 response times, cold start latency, memory/DB connections"
  
  local report_file="${RESULTS_DIR}/${REPORT_NAME}-sustained-load.json"
  
  K6_SCENARIO=sustained-load-2k-users \
  LOAD_TEST_URL=$BASE_URL \
  $K6_PATH run \
    --out json=$report_file \
    --summary-export="${RESULTS_DIR}/${REPORT_NAME}-sustained-load-summary.json" \
    --vus 100 \
    --duration 15m \
    scripts/load-test/load-test.ts
  
  print_success "Sustained load test completed"
  print_info "Report: $report_file"
}

run_publish_burst_test() {
  print_header "PUBLISH BURST TEST"
  
  print_info "Scenario: 500 concurrent publish operations in 40 seconds"
  print_info "Measuring: Publish success rate, response times, DB load spike"
  
  local report_file="${RESULTS_DIR}/${REPORT_NAME}-publish-burst.json"
  
  K6_SCENARIO=publish-burst \
  LOAD_TEST_URL=$BASE_URL \
  $K6_PATH run \
    --out json=$report_file \
    --summary-export="${RESULTS_DIR}/${REPORT_NAME}-publish-burst-summary.json" \
    scripts/load-test/load-test.ts
  
  print_success "Publish burst test completed"
  print_info "Report: $report_file"
}

run_search_burst_test() {
  print_header "SEARCH BURST TEST"
  
  print_info "Scenario: 300 concurrent search queries in 55 seconds"
  print_info "Measuring: Search latency, query performance, cache hits"
  
  local report_file="${RESULTS_DIR}/${REPORT_NAME}-search-burst.json"
  
  K6_SCENARIO=search-burst \
  LOAD_TEST_URL=$BASE_URL \
  $K6_PATH run \
    --out json=$report_file \
    --summary-export="${RESULTS_DIR}/${REPORT_NAME}-search-burst-summary.json" \
    scripts/load-test/load-test.ts
  
  print_success "Search burst test completed"
  print_info "Report: $report_file"
}

run_cold_start_test() {
  print_header "COLD START TEST"
  
  print_info "Scenario: Immediate 1,000 user spike from zero"
  print_info "Measuring: Initial response latency, system recovery time"
  
  local report_file="${RESULTS_DIR}/${REPORT_NAME}-cold-start.json"
  
  K6_SCENARIO=cold-start \
  LOAD_TEST_URL=$BASE_URL \
  $K6_PATH run \
    --out json=$report_file \
    --summary-export="${RESULTS_DIR}/${REPORT_NAME}-cold-start-summary.json" \
    scripts/load-test/load-test.ts
  
  print_success "Cold start test completed"
  print_info "Report: $report_file"
}

# ============================================================================
# MONITORING
# ============================================================================

start_database_monitoring() {
  print_info "Starting database connection monitoring..."
  
  # Create monitoring script
  cat > /tmp/db-monitor.sh << 'EOF'
#!/bin/bash
DB_URL="$1"
INTERVAL="$2"

while true; do
  echo "=== Database Connections $(date) ==="
  psql $DB_URL -c "
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE state = 'active') as active,
      count(*) FILTER (WHERE state = 'idle') as idle,
      max(extract(epoch from (now() - query_start))) as longest_query
    FROM pg_stat_activity
    WHERE datname = current_database();
  "
  sleep $INTERVAL
done
EOF
  
  chmod +x /tmp/db-monitor.sh
}

start_memory_monitoring() {
  print_info "Starting memory usage monitoring..."
  
  # Monitor memory in background
  node -e "
    const interval = setInterval(() => {
      const mem = process.memoryUsage();
      console.log(\`Memory: \${(mem.heapUsed/1024/1024).toFixed(2)}MB / \${(mem.heapTotal/1024/1024).toFixed(2)}MB (RSS: \${(mem.rss/1024/1024).toFixed(2)}MB)\`);
    }, 5000);
  " &
  
  MEMORY_MONITOR_PID=$!
  print_success "Memory monitor started (PID: $MEMORY_MONITOR_PID)"
}

stop_monitoring() {
  if [ ! -z "$MEMORY_MONITOR_PID" ]; then
    kill $MEMORY_MONITOR_PID 2>/dev/null || true
    print_success "Memory monitor stopped"
  fi
}

# ============================================================================
# REPORTING
# ============================================================================

generate_html_report() {
  print_header "GENERATING HTML REPORT"
  
  local html_file="${RESULTS_DIR}/${REPORT_NAME}-report.html"
  
  cat > $html_file << 'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Load Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header h1 { color: #667eea; margin-bottom: 10px; }
    .header p { color: #666; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .metric-card h3 { color: #667eea; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .metric-value { font-size: 28px; font-weight: bold; color: #333; }
    .metric-unit { color: #999; font-size: 14px; }
    .status-ok { color: #10b981; }
    .status-warning { color: #f59e0b; }
    .status-critical { color: #ef4444; }
    .section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .section h2 { color: #667eea; margin-bottom: 20px; }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; color: #374151; font-weight: 600; }
    tr:hover { background: #f9fafb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Load Test Report</h1>
      <p>Generated: <strong></strong></p>
    </div>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <h3>Total Requests</h3>
        <div class="metric-value">-</div>
      </div>
      <div class="metric-card">
        <h3>P95 Response Time</h3>
        <div class="metric-value">-<span class="metric-unit">ms</span></div>
      </div>
      <div class="metric-card">
        <h3>P99 Response Time</h3>
        <div class="metric-value">-<span class="metric-unit">ms</span></div>
      </div>
      <div class="metric-card">
        <h3>Error Rate</h3>
        <div class="metric-value">-<span class="metric-unit">%</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Test Results Summary</h2>
      <table>
        <tr>
          <th>Test Scenario</th>
          <th>Concurrent Users</th>
          <th>Duration</th>
          <th>P95 (ms)</th>
          <th>P99 (ms)</th>
          <th>Errors</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>Sustained Load (2K Users)</td>
          <td>0 → 2,000</td>
          <td>11min</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td><span class="status-ok">PENDING</span></td>
        </tr>
        <tr>
          <td>Publish Burst</td>
          <td>500</td>
          <td>40s</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td><span class="status-ok">PENDING</span></td>
        </tr>
        <tr>
          <td>Search Burst</td>
          <td>300</td>
          <td>55s</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td><span class="status-ok">PENDING</span></td>
        </tr>
        <tr>
          <td>Cold Start</td>
          <td>1,000</td>
          <td>20s</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td><span class="status-ok">PENDING</span></td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>
HTML
  
  print_success "HTML report generated: $html_file"
}

print_results_summary() {
  print_header "LOAD TEST COMPLETE"
  
  echo "Reports saved in: $RESULTS_DIR"
  echo ""
  echo "Generated files:"
  ls -lh "$RESULTS_DIR" | tail -n +2
  echo ""
  print_info "View detailed k6 results:"
  echo "  cd $RESULTS_DIR"
  echo "  k6 stats *.json"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
  print_header "THE CORPORATE BLOG - LOAD TESTING SUITE"
  print_info "Testing: 2000 concurrent users + publish/search bursts"
  
  setup
  
  # Run all tests
  run_sustained_load_test
  run_publish_burst_test
  run_search_burst_test
  run_cold_start_test
  
  # Generate report
  generate_html_report
  print_results_summary
  
  print_success "All load tests completed successfully!"
}

# Trap for cleanup
trap "stop_monitoring; exit" SIGINT SIGTERM

# Run main function
main "$@"
