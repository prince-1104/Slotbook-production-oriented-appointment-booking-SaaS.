import type { NextRequest } from 'next/server';

import { getRequestId, handleRouteError, jsonSuccess } from '@/lib/api/http';
import { requireHostSession } from '@/lib/auth/session';
import { assertRateLimit } from '@/lib/rate-limit/pg-rate-limiter';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const session = await requireHostSession(request);
    await assertRateLimit({
      key: `auth:me:host:${session.host.id}`,
      limit: 60,
      windowSeconds: 60,
    });

    return jsonSuccess({ host: session.host }, requestId, 200);
  } catch (err) {
    return handleRouteError(err, requestId, '/api/v1/auth/me');
  }
}
