/**
 * Load Testing Configuration
 * Dashboard, metrics collection, and reporting setup
 */

export const LOAD_TEST_CONFIG = {
  baseUrl: process.env.LOAD_TEST_URL || 'http://localhost:3000',
  
  // Thresholds for test success
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000', 'avg<200'],
    'http_req_failed': ['rate<0.1'],  // Less than 10% failure rate
    'http_reqs_per_sec': ['avg>100'],
    'grpc_req_duration': ['p(95)<500'],
    'checks': ['rate>0.95'],  // 95% success rate
  },

  // Scenario definitions
  scenarios: {
    // Sustained load test
    sustainedLoad: {
      name: 'sustained-load-2k-users',
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 100 },   // Ramp up to 100 users over 1 minute
        { duration: '2m', target: 500 },   // Continue ramping to 500 users
        { duration: '3m', target: 1000 },  // Continue to 1000 users
        { duration: '5m', target: 2000 },  // Peak at 2000 concurrent users
        { duration: '3m', target: 1000 },  // Ramp down
        { duration: '1m', target: 0 },     // Complete ramp down
      ],
      gracefulRampDown: '30s',
    },

    // Publish burst test (simulate many editors publishing at once)
    publishBurst: {
      name: 'publish-burst-spike',
      executor: 'ramping-vus',
      startTime: '15m',  // Start after sustained load stabilizes
      stages: [
        { duration: '30s', target: 0 },    // Baseline
        { duration: '10s', target: 500 },  // Burst to 500 users (publishes)
        { duration: '30s', target: 500 },  // Sustain burst
        { duration: '10s', target: 0 },    // Sudden drop
      ],
    },

    // Search burst test (many users searching simultaneously)
    searchBurst: {
      name: 'search-burst-spike',
      executor: 'ramping-vus',
      startTime: '22m',  // After publish burst
      stages: [
        { duration: '30s', target: 0 },    // Baseline
        { duration: '10s', target: 300 },  // Burst to 300 search users
        { duration: '45s', target: 300 },  // Sustain
        { duration: '10s', target: 0 },    // Drop
      ],
    },

    // Cold start test (simulates deployment or traffic spike)
    coldStart: {
      name: 'cold-start-spike',
      executor: 'ramping-vus',
      startTime: '0s',
      stages: [
        { duration: '5s', target: 1000 },  // Immediate spike to 1000 users
        { duration: '30s', target: 1000 }, // Hold
        { duration: '5s', target: 0 },     // Drop
      ],
    },
  },

  // Metrics collection
  metrics: {
    // Response time percentiles
    responseTime: ['p(50)', 'p(75)', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
    
    // Request distribution
    requests: ['count', 'rate', 'errors', 'errorRate'],
    
    // Database metrics
    database: ['connections', 'idle', 'active', 'waiting', 'poolSize'],
    
    // Memory metrics
    memory: ['heapUsed', 'heapTotal', 'external', 'rss', 'spikePeak'],
    
    // Business metrics
    business: ['successfulPublishes', 'failedPublishes', 'searchQueries', 'cacheHits'],
  },

  // Monitoring intervals
  monitoring: {
    metricsInterval: '5s',        // Collect metrics every 5 seconds
    alertInterval: '10s',         // Check alerts every 10 seconds
    reportInterval: '30s',        // Generate reports every 30 seconds
    dbConnectionCheckInterval: '2s',  // Check DB connections frequently
  },

  // Alert thresholds
  alerts: {
    p95Response: 500,             // P95 > 500ms = alert
    p99Response: 1000,            // P99 > 1000ms = alert
    errorRate: 0.05,              // > 5% errors = critical alert
    memorySpike: 0.8,             // > 80% of max = alert
    dbConnectionThreshold: 20,    // > 20 connections = warn
    activeConnections: 25,        // > 25 active = alert
  },

  // Report generation
  reporting: {
    format: 'json',
    exportMetrics: true,
    chartGeneration: true,
    comparisonVsBaseline: true,
    slowQueryAnalysis: true,
  },
};

export const TEST_ENDPOINTS = {
  // Homepage - simple read
  home: {
    name: 'GET /',
    method: 'GET',
    path: '/',
    weight: 0.15,  // 15% of traffic
  },

  // Blog listing - read with filtering
  blogListing: {
    name: 'GET /blog',
    method: 'GET',
    path: '/blog',
    weight: 0.20,  // 20% of traffic
  },

  // Individual post - heavy read
  blogPost: {
    name: 'GET /blog/[slug]',
    method: 'GET',
    path: (slug) => `/blog/${slug}`,
    weight: 0.35,  // 35% of traffic (most popular)
  },

  // Search - read with query
  search: {
    name: 'GET /search?q=...',
    method: 'GET',
    path: (q) => `/search?q=${encodeURIComponent(q)}`,
    weight: 0.15,  // 15% of traffic
  },

  // API: Publish post
  publishPost: {
    name: 'PUT /api/posts/[id]',
    method: 'PUT',
    path: (id) => `/api/posts/${id}`,
    weight: 0.05,  // 5% write operations
    requiresAuth: true,
  },

  // API: Delete post  
  deletePost: {
    name: 'DELETE /api/posts/[id]',
    method: 'DELETE',
    path: (id) => `/api/posts/${id}`,
    weight: 0.05,  // 5% delete operations
    requiresAuth: true,
  },

  // API: Health check
  health: {
    name: 'GET /api/health',
    method: 'GET',
    path: '/api/health',
    weight: 0.05,  // 5% health checks
  },
};

export const TEST_DATA = {
  // Sample post slugs for read testing
  postSlugs: [
    'building-production-grade-apis-nodejs-typescript',
    'future-remote-work-trends-technologies',
    'ai-driven-content-strategy-complete-guide',
    'scaling-postgresql-for-production',
    'nextjs-performance-optimization',
    'typescript-best-practices-2024',
    'cloudflare-workers-edge-computing',
    'database-indexing-strategies',
    'api-security-hardening',
    'monitoring-observability-production',
  ],

  // Sample search queries
  searchQueries: [
    'nodejs performance',
    'typescript patterns',
    'database optimization',
    'api security',
    'nextjs deployment',
    'monitoring tools',
    'caching strategies',
    'testing practices',
    'devops tools',
    'cloud infrastructure',
  ],

  // Sample post data for create/publish operations
  postTemplates: [
    {
      title: '[LOAD TEST] Post #$N - Performance Optimization',
      slug: 'load-test-performance-$N',
      content: 'Performance optimization techniques including caching, indexing, and query optimization.',
      excerpt: 'This is a load test post about performance optimization.',
      tags: ['performance', 'optimization', 'load-test'],
    },
    {
      title: '[LOAD TEST] Post #$N - Security Best Practices',
      slug: 'load-test-security-$N',
      content: 'Security best practices for production applications.',
      excerpt: 'Load test post on security.',
      tags: ['security', 'best-practices', 'load-test'],
    },
    {
      title: '[LOAD TEST] Post #$N - Deployment Strategies',
      slug: 'load-test-deployment-$N',
      content: 'Effective deployment strategies for different environments.',
      excerpt: 'Load test post on deployment.',
      tags: ['deployment', 'devops', 'load-test'],
    },
  ],
};

export const MONITORING_CONFIG = {
  // Database connection monitoring
  database: {
    enabled: true,
    query: `
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        max(extract(epoch from (now() - query_start))) as longest_query_duration
      FROM pg_stat_activity
      WHERE datname = current_database()
    `,
    interval: 2000,  // Every 2 seconds
  },

  // Memory monitoring
  memory: {
    enabled: true,
    interval: 5000,  // Every 5 seconds
    trackPeaks: true,
    alertOnSpike: true,
    spikeThreshold: 0.15,  // 15% increase = spike
  },

  // Application metrics
  application: {
    enabled: true,
    interval: 10000,
    metrics: ['requestCount', 'errorCount', 'avgLatency', 'cacheHitRate'],
  },

  // System metrics
  system: {
    enabled: true,
    interval: 5000,
    metrics: ['cpuUsage', 'memoryUsage', 'diskIO', 'networkIO'],
  },
};

export default LOAD_TEST_CONFIG;
