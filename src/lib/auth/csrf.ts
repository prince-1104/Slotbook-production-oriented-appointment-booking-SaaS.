import { getEnv } from '@/lib/config/env-core';
import { ForbiddenError, UnsupportedMediaTypeError } from '@/lib/errors';

export interface CsrfCheckOptions {
  requireJsonContentType?: boolean;
}

export function assertValidCsrf(request: Request, options: CsrfCheckOptions = {}): void {
  const { requireJsonContentType = true } = options;

  if (requireJsonContentType) {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new UnsupportedMediaTypeError('Content-Type must be application/json');
    }
  }

  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite === 'cross-site') {
    throw new ForbiddenError('CSRF_CROSS_SITE', 'Cross-site state-changing request rejected');
  }

  const expectedOrigin = new URL(getEnv().APP_URL).origin;

  const origin = request.headers.get('origin');
  if (origin !== null) {
    let parsedOrigin: string;
    try {
      parsedOrigin = new URL(origin).origin;
    } catch {
      throw new ForbiddenError('CSRF_ORIGIN_INVALID', 'Invalid Origin header');
    }
    if (parsedOrigin !== expectedOrigin) {
      throw new ForbiddenError('CSRF_ORIGIN_MISMATCH', 'Origin does not match application origin');
    }
    return;
  }

  const referer = request.headers.get('referer');
  if (referer !== null) {
    let parsedRefererOrigin: string;
    try {
      parsedRefererOrigin = new URL(referer).origin;
    } catch {
      throw new ForbiddenError('CSRF_REFERER_INVALID', 'Invalid Referer header');
    }
    if (parsedRefererOrigin !== expectedOrigin) {
      throw new ForbiddenError(
        'CSRF_REFERER_MISMATCH',
        'Referer origin does not match application origin',
      );
    }
  }
}
