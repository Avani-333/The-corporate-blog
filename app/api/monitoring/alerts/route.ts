import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0;

interface MonitoringAlert {
  metric: string;
  current: number;
  baseline: number;
  threshold: number;
  regression: number;
  severity: 'warning' | 'critical';
  timestamp: string;
  pageUrl: string;
}

interface MonitoringReport {
  timestamp: string;
  pageUrl: string;
  alerts: MonitoringAlert[];
  metrics?: {
    fcp?: number;
    lcp?: number;
    cls?: number;
    tti?: number;
    performanceScore?: number;
  };
}

/**
 * Backend endpoint for receiving performance monitoring alerts
 *
 * Receives regression alerts from PerformanceMonitoringProvider
 * and stores them for analysis, trending, and alerting
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MonitoringReport;

    // Validate required fields
    if (!body.timestamp || !body.pageUrl || !Array.isArray(body.alerts)) {
      return NextResponse.json(
        { error: 'Missing required fields: timestamp, pageUrl, alerts' },
        { status: 400 }
      );
    }

    // Log critical alerts for alerting
    const criticalAlerts = body.alerts.filter((a) => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.warn('[PERFORMANCE_ALERT]', {
        url: body.pageUrl,
        timestamp: body.timestamp,
        alerts: criticalAlerts,
      });

      // TODO: Integrate with alerting service (Slack, PagerDuty, etc.)
      // Example:
      // await notifySlack({
      //   channel: '#performance-alerts',
      //   message: `⚠️ Performance regression detected`,
      //   blocks: formatAlerts(criticalAlerts)
      // });
    }

    // Store for analytics/trending
    // TODO: Store in database for historical analysis
    // await db.performanceAlert.createMany({
    //   data: body.alerts.map(alert => ({
    //     ...alert,
    //     pageUrl: body.pageUrl,
    //     recordedAt: new Date()
    //   }))
    // });

    // Log for observability
    console.log('[monitoring-alert]', {
      pageUrl: body.pageUrl,
      alertCount: body.alerts.length,
      criticalCount: criticalAlerts.length,
      metrics: body.metrics,
    });

    return NextResponse.json(
      {
        success: true,
        stored: body.alerts.length,
        critical: criticalAlerts.length,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('monitoring-alert ingestion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process monitoring alert',
      },
      { status: 400 }
    );
  }
}

/**
 * GET endpoint to retrieve recent alerts
 *
 * Query parameters:
 * - severity: 'critical' | 'warning' (optional)
 * - limit: number (default: 20)
 * - hours: number (default: 24)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const hours = parseInt(searchParams.get('hours') || '24');

    // TODO: Query database for recent alerts
    // const alerts = await db.performanceAlert.findMany({
    //   where: {
    //     severity: severity || undefined,
    //     recordedAt: {
    //       gte: new Date(Date.now() - hours * 60 * 60 * 1000)
    //     }
    //   },
    //   orderBy: { recordedAt: 'desc' },
    //   take: limit
    // });

    // Placeholder response
    const alerts: MonitoringAlert[] = [];

    return NextResponse.json({
      success: true,
      count: alerts.length,
      severity: severity || 'all',
      timeRange: `${hours}h`,
      alerts,
    });
  } catch (error) {
    console.error('Failed to fetch monitoring alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alerts',
      },
      { status: 500 }
    );
  }
}
