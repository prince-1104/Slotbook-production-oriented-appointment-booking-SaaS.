import { NextResponse, type NextRequest } from 'next/server';

import { getPool } from '@/lib/db';
import { withRequestLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const logger = withRequestLogger(requestId, { route: '/api/v1/health' });

  try {
    const pool = getPool();
    await pool.query('SELECT 1');

    return NextResponse.json(
      {
        data: {
          status: 'ok',
          database: 'connected',
          timestamp: new Date().toISOString(),
        },
        requestId,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    return NextResponse.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database connectivity check failed',
        },
        requestId,
      },
      { status: 503 },
    );
  }
}
