import type { NextRequest } from 'next/server';

import {
  getClientIp,
  getRequestId,
  handleRouteError,
  jsonSuccess,
  parseJsonBody,
} from '@/lib/api/http';
import { assertValidCsrf } from '@/lib/auth/csrf';
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
  createHostSession,
} from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { authenticateHostCredentials, loginInputSchema } from '@/lib/domain/host-service';
import { assertRateLimit } from '@/lib/rate-limit/pg-rate-limiter';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    assertValidCsrf(request);

    const ip = getClientIp(request);
    await assertRateLimit({
      key: `auth:login:ip:${ip}`,
      limit: 5,
      windowSeconds: 60,
    });

    const input = await parseJsonBody(request, loginInputSchema);
    const db = getDb();
    const host = await authenticateHostCredentials(db, input);

    const userAgent = request.headers.get('user-agent');
    const session = await db.transaction(async (tx) => {
      const created = await createHostSession(tx, host.id, {
        ipAddress: ip,
        userAgent,
      });

      await tx.insert(auditLogs).values({
        hostId: host.id,
        action: 'host.login',
        details: { sessionId: created.sessionId },
        ipAddress: ip,
        requestId,
      });

      return created;
    });

    const response = jsonSuccess({ host }, requestId, 200);
    response.cookies.set(SESSION_COOKIE_NAME, session.rawToken, buildSessionCookieOptions());
    return response;
  } catch (err) {
    return handleRouteError(err, requestId, '/api/v1/auth/login');
  }
}
