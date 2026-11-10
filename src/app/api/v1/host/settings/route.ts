import type { NextRequest } from 'next/server';

import {
  getClientIp,
  getRequestId,
  handleRouteError,
  jsonSuccess,
  parseJsonBody,
} from '@/lib/api/http';
import { assertValidCsrf } from '@/lib/auth/csrf';
import { requireHostSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import {
  getHostProfile,
  updateHostSettings,
  updateHostSettingsSchema,
} from '@/lib/domain/host-service';
import { assertRateLimit } from '@/lib/rate-limit/pg-rate-limiter';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const session = await requireHostSession(request);
    await assertRateLimit({
      key: `host:settings:read:${session.host.id}`,
      limit: 60,
      windowSeconds: 60,
    });

    const host = await getHostProfile(getDb(), session.host.id);
    return jsonSuccess({ host }, requestId, 200);
  } catch (err) {
    return handleRouteError(err, requestId, '/api/v1/host/settings');
  }
}

export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    assertValidCsrf(request);
    const session = await requireHostSession(request);

    await assertRateLimit({
      key: `host:settings:write:${session.host.id}`,
      limit: 30,
      windowSeconds: 60,
    });

    const input = await parseJsonBody(request, updateHostSettingsSchema);
    const host = await updateHostSettings(getDb(), session.host.id, input, {
      ipAddress: getClientIp(request),
      requestId,
    });

    return jsonSuccess({ host }, requestId, 200);
  } catch (err) {
    return handleRouteError(err, requestId, '/api/v1/host/settings');
  }
}
