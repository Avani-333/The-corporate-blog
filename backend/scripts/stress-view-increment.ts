import http from 'http';
import https from 'https';

interface StressOptions {
  baseUrl: string;
  slug: string;
  requests: number;
  concurrency: number;
}

interface RequestResult {
  ok: boolean;
  statusCode: number;
  durationMs: number;
  uniqueTracked: boolean;
}

function parseArg(name: string, fallback?: string): string | undefined {
  const raw = process.argv.find((arg: string) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const [, value] = raw.split('=');
  return value || fallback;
}

function parseNumberArg(name: string, fallback: number): number {
  const value = parseArg(name);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((p / 100) * sortedValues.length)));
  return sortedValues[index];
}

function doGet(urlString: string): Promise<RequestResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const parsed = new URL(urlString);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: {
          'user-agent': `stress-test/${Math.floor(Math.random() * 10_000_000)}`,
          accept: 'application/json',
          connection: 'keep-alive',
        },
      },
      (res: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const durationMs = Date.now() - startedAt;
          const body = Buffer.concat(chunks).toString('utf8');
          let uniqueTracked = false;

          try {
            const json = JSON.parse(body);
            uniqueTracked = Boolean(json?.data?.uniqueDailyViewTracked);
          } catch {
            // Ignore body parse errors for stress telemetry.
          }

          resolve({
            ok: (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300,
            statusCode: res.statusCode || 500,
            durationMs,
            uniqueTracked,
          });
        });
      }
    );

    req.on('error', () => {
      resolve({
        ok: false,
        statusCode: 0,
        durationMs: Date.now() - startedAt,
        uniqueTracked: false,
      });
    });

    req.end();
  });
}

async function runStressTest(options: StressOptions): Promise<void> {
  const endpoint = `${options.baseUrl.replace(/\/+$/, '')}/api/posts/${options.slug}`;
  const queue = Array.from({ length: options.requests }, (_, index) => index);
  const results: RequestResult[] = [];

  const workers = Array.from({ length: options.concurrency }, async () => {
    while (queue.length > 0) {
      queue.pop();
      const result = await doGet(endpoint);
      results.push(result);
    }
  });

  const startedAt = Date.now();
  await Promise.all(workers);
  const totalDurationMs = Date.now() - startedAt;

  const successCount = results.filter((result) => result.ok).length;
  const uniqueTrackedCount = results.filter((result) => result.uniqueTracked).length;
  const latencies = results.map((result) => result.durationMs).sort((a, b) => a - b);

  const rps = totalDurationMs > 0 ? (results.length / totalDurationMs) * 1000 : 0;

  console.log('--- View Increment Stress Test ---');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Requests: ${options.requests}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Success: ${successCount}/${results.length} (${((successCount / Math.max(1, results.length)) * 100).toFixed(2)}%)`);
  console.log(`Unique daily increments accepted: ${uniqueTrackedCount}`);
  console.log(`Duration: ${totalDurationMs}ms`);
  console.log(`RPS: ${rps.toFixed(2)}`);
  console.log(`Latency p50: ${percentile(latencies, 50)}ms`);
  console.log(`Latency p95: ${percentile(latencies, 95)}ms`);
  console.log(`Latency p99: ${percentile(latencies, 99)}ms`);
}

async function main(): Promise<void> {
  const slug = parseArg('slug', process.argv[2]);
  if (!slug) {
    console.error('Missing slug. Usage: npm run stress:view -- --slug=<post-slug> [--baseUrl=http://localhost:3001] [--requests=1000] [--concurrency=50]');
    process.exit(1);
  }

  const selectedSlug = String(slug);

  const options: StressOptions = {
    baseUrl: parseArg('baseUrl', 'http://localhost:3001') || 'http://localhost:3001',
    slug: selectedSlug,
    requests: parseNumberArg('requests', 1000),
    concurrency: parseNumberArg('concurrency', 50),
  };

  await runStressTest(options);
}

main().catch((error) => {
  console.error('Stress test failed:', error);
  process.exit(1);
});
