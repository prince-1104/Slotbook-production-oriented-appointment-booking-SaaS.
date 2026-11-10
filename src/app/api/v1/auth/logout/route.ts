import type { NextRequest } from 'next/server';

import { getRequestId, handleRouteError, jsonSuccess } from '@/lib/api/http';
import { assertValidCsrf } from '@/lib/auth/csrf';
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
  revokeHostSession,
} from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    assertValidCsrf(request);

    const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
      await revokeHostSession(rawToken);
    }

    const response = jsonSuccess({ loggedOut: true }, requestId, 200);
    response.cookies.set(SESSION_COOKIE_NAME, '', buildSessionCookieOptions(0));
    return response;
  } catch (err) {
    return handleRouteError(err, requestId, '/api/v1/auth/logout');
  }
}
