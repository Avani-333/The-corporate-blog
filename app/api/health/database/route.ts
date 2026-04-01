/**
 * Database Health Check API Endpoint
 * GET /api/health/database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnectionStatus, testConnection } from '@/lib/database/connection';

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive connection status
    const status = await getConnectionStatus();
    
    // Additional health checks
    const healthChecks = {
      database: status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    };

    // Determine overall health status
    const isHealthy = status.status === 'connected' && 
                     status.latency !== undefined && 
                     status.latency < 5000; // 5 second threshold

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'unhealthy',
        checks: healthChecks,
        message: isHealthy ? 'All systems operational' : 'Database issues detected'
      },
      { 
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

// Simplified health check for load balancers
export async function HEAD(request: NextRequest) {
  try {
    const connectionTest = await testConnection();
    
    if (connectionTest.success) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 });
    }
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}