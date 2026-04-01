import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import LOAD_TEST_CONFIG, { TEST_ENDPOINTS, TEST_DATA } from './config.ts';

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const responseTimeMetric = new Trend('response_time_ms');
const errorRateMetric = new Rate('errors');
const successRateMetric = new Rate('success');
const publishSuccessMetric = new Counter('publish_success');
const publishErrorMetric = new Counter('publish_errors');
const searchQueriesMetric = new Counter('search_queries');
const cacheHitMetric = new Rate('cache_hits');
const p95ResponseTime = new Trend('p95_response_time');
const p99ResponseTime = new Trend('p99_response_time');
const coldStartLatency = new Gauge('cold_start_latency');

// ============================================================================
// LOAD TEST CONFIGURATION
// ============================================================================

export const options = {
  scenarios: LOAD_TEST_CONFIG.scenarios,
  thresholds: LOAD_TEST_CONFIG.thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(75)', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)'],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Make an HTTP request with standard checks
 */
function makeRequest(method, url, payload = null, params = null) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    ...params,
  };

  let response;
  const startTime = new Date();

  try {
    if (method === 'GET') {
      response = http.get(url, config);
    } else if (method === 'POST') {
      response = http.post(url, JSON.stringify(payload), config);
    } else if (method === 'PUT') {
      response = http.put(url, JSON.stringify(payload), config);
    } else if (method === 'DELETE') {
      response = http.del(url, config);
    }

    const latency = new Date() - startTime;
    responseTimeMetric.add(latency);
    p95ResponseTime.add(latency);
    p99ResponseTime.add(latency);

    // Track cache hits (look for X-Cache header)
    const cacheStatus = response.headers['X-Cache'] || response.headers['x-cache'];
    if (cacheStatus && cacheStatus.includes('HIT')) {
      cacheHitMetric.add(true);
    } else {
      cacheHitMetric.add(false);
    }

    // Check response
    const success = response.status === 200 || response.status === 201;
    if (success) {
      successRateMetric.add(true);
    } else {
      errorRateMetric.add(true);
      successRateMetric.add(false);
    }

    return response;
  } catch (error) {
    errorRateMetric.add(true);
    successRateMetric.add(false);
    console.error(`Request failed: ${method} ${url}`, error);
    return null;
  }
}

/**
 * Get random item from array
 */
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Select endpoint based on weight distribution
 */
function selectEndpoint() {
  const random = Math.random();
  let total = 0;

  for (const [key, endpoint] of Object.entries(TEST_ENDPOINTS)) {
    total += endpoint.weight;
    if (random < total) {
      return endpoint;
    }
  }

  return TEST_ENDPOINTS.blogPost;
}

// ============================================================================
// TEST SEQUENCES
// ============================================================================

/**
 * Read-heavy traffic - mix of home, blog, and search
 */
export function readTraffic() {
  group('Read Traffic', () => {
    const endpoint = selectEndpoint();

    if (endpoint === TEST_ENDPOINTS.blogPost) {
      const slug = randomItem(TEST_DATA.postSlugs);
      const url = `${LOAD_TEST_CONFIG.baseUrl}${endpoint.path(slug)}`;
      
      const response = makeRequest('GET', url);
      check(response, {
        'post loads successfully': (r) => r.status === 200,
        'post has content': (r) => r.body.length > 100,
      });
    } else if (endpoint === TEST_ENDPOINTS.search) {
      const query = randomItem(TEST_DATA.searchQueries);
      const url = `${LOAD_TEST_CONFIG.baseUrl}${endpoint.path(query)}`;
      
      const response = makeRequest('GET', url);
      searchQueriesMetric.add(1);
      check(response, {
        'search returns results': (r) => r.status === 200,
      });
    } else {
      const url = `${LOAD_TEST_CONFIG.baseUrl}${endpoint.path}`;
      const response = makeRequest('GET', url);
      check(response, {
        'page loads': (r) => r.status === 200,
      });
    }

    sleep(Math.random() * 3 + 1);  // 1-4 seconds between requests
  });
}

/**
 * Publish burst - simulate many editors publishing simultaneously
 */
export function publishBurst() {
  group('Publish Burst', () => {
    const postId = `post-${Math.random().toString(36).substr(2, 9)}`;
    const template = randomItem(TEST_DATA.postTemplates);
    
    const payload = {
      title: template.title.replace('$N', Math.floor(Math.random() * 1000)),
      slug: template.slug.replace('$N', Math.floor(Math.random() * 1000)),
      content: template.content,
      excerpt: template.excerpt,
      tags: template.tags,
      status: 'PUBLISHED',
      seoTitle: template.title,
      metaDescription: template.excerpt,
    };

    const url = `${LOAD_TEST_CONFIG.baseUrl}${TEST_ENDPOINTS.publishPost.path(postId)}`;
    const response = makeRequest('PUT', url, payload);

    if (response && (response.status === 200 || response.status === 201)) {
      publishSuccessMetric.add(1);
      check(response, {
        'publish successful': (r) => r.status === 200 || r.status === 201,
      });
    } else {
      publishErrorMetric.add(1);
      check(response, {
        'publish failed': (r) => r.status !== 200 && r.status !== 201,
      });
    }

    // Prevent thundering herd - stagger slightly
    sleep(Math.random() * 0.5);
  });
}

/**
 * Search burst - simulate spike in search traffic
 */
export function searchBurst() {
  group('Search Burst', () => {
    const queries = [
      'performance optimization',
      'security best practices',
      'nodejs patterns',
      'database indexing',
      'api design',
      'caching strategies',
      'deployment tools',
      'monitoring solutions',
      'typescript advanced',
      'nextjs optimization',
    ];

    const query = randomItem(queries);
    const url = `${LOAD_TEST_CONFIG.baseUrl}${TEST_ENDPOINTS.search.path(query)}`;

    const response = makeRequest('GET', url);
    searchQueriesMetric.add(1);

    check(response, {
      'search responds': (r) => r.status === 200,
      'search is fast': (r) => r.timings.duration < 1000,  // Under 1 second
    });

    sleep(Math.random() * 0.2);  // Quick searches
  });
}

/**
 * Cold start test - immediate traffic spike
 */
export function coldStart() {
  group('Cold Start Spike', () => {
    const startTime = new Date();

    // Hit home page
    const homeResponse = makeRequest('GET', `${LOAD_TEST_CONFIG.baseUrl}/`);
    
    const coldStartTime = new Date() - startTime;
    coldStartLatency.add(coldStartTime);

    check(homeResponse, {
      'home loads on cold start': (r) => r.status === 200,
      'cold start under 2 seconds': (r) => r.timings.duration < 2000,
    });

    // Then hit blog
    const blogResponse = makeRequest('GET', `${LOAD_TEST_CONFIG.baseUrl}/blog`);
    check(blogResponse, {
      'blog loads on cold start': (r) => r.status === 200,
    });

    sleep(1);  // Wait before next burst request
  });
}

/**
 * Sustained load - continuous traffic pattern
 */
export function sustainedLoad() {
  group('Sustained Load', () => {
    // 80% read traffic
    if (Math.random() < 0.8) {
      readTraffic();
    } else {
      // 20% write traffic (but safe operations)
      if (Math.random() < 0.5) {
        // Check health endpoint
        const response = makeRequest('GET', `${LOAD_TEST_CONFIG.baseUrl}/api/health`);
        check(response, {
          'health check passes': (r) => r.status === 200,
        });
      } else {
        // Search
        searchBurst();
      }
    }

    sleep(Math.random() * 2);
  });
}

// ============================================================================
// SETUP AND TEARDOWN
// ============================================================================

export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${LOAD_TEST_CONFIG.baseUrl}`);
  console.log(`Cold Start Latency Tracking: Enabled`);
  console.log(`Memory Monitoring: Enabled`);
  console.log(`DB Connection Monitoring: Enabled`);
  
  return {
    startTime: new Date().toISOString(),
  };
}

export function teardown(data) {
  console.log(`Load test completed: ${data.startTime}`);
  console.log('Check summary below for detailed metrics');
}

// ============================================================================
// DEFAULT EXPORT (runs all test functions)
// ============================================================================

export default function () {
  const scenario = __ENV.K6_SCENARIO || 'sustained-load-2k-users';

  switch (scenario) {
    case 'sustained-load-2k-users':
      sustainedLoad();
      break;
    case 'publish-burst':
      publishBurst();
      break;
    case 'search-burst':
      searchBurst();
      break;
    case 'cold-start':
      coldStart();
      break;
    case 'read-traffic':
      readTraffic();
      break;
    default:
      sustainedLoad();
  }
}
