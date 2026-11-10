import { sql } from 'drizzle-orm';

import { getDb, type DbExecutor } from '@/lib/db';
import { RateLimitError } from '@/lib/errors';

export interface RateLimitPolicy {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

interface RawBucketRow {
  window_start: Date | string;
  current_count: number;
  previous_count: number;
  now_ts: Date | string;
}

export async function consumeRateLimit(
  policy: RateLimitPolicy,
  executor?: DbExecutor,
): Promise<RateLimitResult> {
  const db = executor ?? getDb();
  const { key, limit, windowSeconds } = policy;

  const result = await db.execute(sql`
    WITH params AS (
      SELECT
        NOW() AS now_ts,
        to_timestamp(floor(extract(epoch FROM NOW()) / ${windowSeconds}) * ${windowSeconds}) AS curr_win,
        to_timestamp(floor(extract(epoch FROM NOW()) / ${windowSeconds}) * ${windowSeconds})
          - (${windowSeconds} * interval '1 second') AS prev_win
    )
    INSERT INTO rate_limit_buckets (key, window_start, current_count, previous_count, expires_at)
    SELECT
      ${key},
      params.curr_win,
      1,
      0,
      params.curr_win + (${windowSeconds * 2} * interval '1 second')
    FROM params
    ON CONFLICT (key) DO UPDATE SET
      previous_count = CASE
        WHEN rate_limit_buckets.window_start = (SELECT curr_win FROM params)
          THEN rate_limit_buckets.previous_count
        WHEN rate_limit_buckets.window_start = (SELECT prev_win FROM params)
          THEN rate_limit_buckets.current_count
        ELSE 0
      END,
      current_count = CASE
        WHEN rate_limit_buckets.window_start = (SELECT curr_win FROM params)
          THEN LEAST(rate_limit_buckets.current_count + 1, ${limit + 1})
        ELSE 1
      END,
      window_start = (SELECT curr_win FROM params),
      expires_at = (SELECT curr_win FROM params) + (${windowSeconds * 2} * interval '1 second')
    RETURNING
      window_start,
      current_count,
      previous_count,
      (SELECT now_ts FROM params) AS now_ts
  `);

  const row = result.rows[0] as unknown as RawBucketRow | undefined;
  if (!row) {
    throw new Error('Failed to evaluate PostgreSQL rate limit bucket');
  }

  const windowStart = new Date(row.window_start);
  const nowTs = new Date(row.now_ts);
  const elapsedSeconds = Math.max(0, (nowTs.getTime() - windowStart.getTime()) / 1000);
  const overlapWeight = Math.max(0, 1 - elapsedSeconds / windowSeconds);
  const estimatedCount = row.previous_count * overlapWeight + row.current_count;

  const allowed = estimatedCount <= limit;
  const remaining = allowed ? Math.max(0, Math.floor(limit - estimatedCount)) : 0;
  const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((resetAt.getTime() - nowTs.getTime()) / 1000));

  return {
    allowed,
    limit,
    remaining,
    retryAfterSeconds,
    resetAt,
  };
}

export async function assertRateLimit(
  policy: RateLimitPolicy,
  executor?: DbExecutor,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(policy, executor);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
  return result;
}
