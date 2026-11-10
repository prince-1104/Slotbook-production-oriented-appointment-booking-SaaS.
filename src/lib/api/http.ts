import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodType } from 'zod';

import { AppError, BadRequestError, RateLimitError, ValidationError } from '@/lib/errors';
import { withRequestLogger } from '@/lib/logger';

export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return '127.0.0.1';
}

export async function parseJsonBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequestError('INVALID_JSON', 'Request body must be valid JSON');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      'VALIDATION_ERROR',
      'Request validation failed',
      z.flattenError(parsed.error),
    );
  }

  return parsed.data;
}

export function jsonSuccess<T>(
  data: T,
  requestId: string,
  status = 200,
  headers?: HeadersInit,
): NextResponse {
  const response = NextResponse.json({ data, requestId }, { status, headers });
  response.headers.set('X-Request-Id', requestId);
  return response;
}

export function handleRouteError(err: unknown, requestId: string, route: string): NextResponse {
  const logger = withRequestLogger(requestId, { route });

  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error({ err, code: err.code }, err.message);
    } else {
      logger.warn({ code: err.code, httpStatus: err.httpStatus }, err.message);
    }

    const headers: Record<string, string> = { 'X-Request-Id': requestId };
    if (err instanceof RateLimitError) {
      headers['Retry-After'] = String(err.retryAfterSeconds);
    }

    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
        requestId,
      },
      { status: err.httpStatus, headers },
    );
  }

  logger.error({ err }, 'Unhandled route error');
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
      requestId,
    },
    { status: 500, headers: { 'X-Request-Id': requestId } },
  );
}
