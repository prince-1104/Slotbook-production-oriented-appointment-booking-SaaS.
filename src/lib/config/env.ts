import 'server-only';

import { z } from 'zod';

const emptyStringToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

const optionalNonEmptyString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());

const envSchema = z
  .object({
    APP_ENV: z.preprocess(
      emptyStringToUndefined,
      z.enum(['development', 'test', 'production']).default('development'),
    ),
    APP_URL: z.preprocess(emptyStringToUndefined, z.url().optional()),
    DATABASE_URL: optionalNonEmptyString,
    SESSION_SECRET: z.preprocess(emptyStringToUndefined, z.string().min(32).optional()),
    RESEND_API_KEY: optionalNonEmptyString,
    EMAIL_FROM: z.preprocess(
      emptyStringToUndefined,
      z.string().min(3).default('Slotbook <noreply@example.com>'),
    ),
    LOG_LEVEL: z.preprocess(
      emptyStringToUndefined,
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.APP_ENV === 'production' && !data.APP_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_URL'],
        message: 'APP_URL is required when APP_ENV=production',
      });
    }
  });

export interface AppEnv {
  APP_ENV: 'development' | 'test' | 'production';
  APP_URL: string;
  DATABASE_URL: string | undefined;
  SESSION_SECRET: string | undefined;
  RESEND_API_KEY: string | undefined;
  EMAIL_FROM: string;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

let cachedEnv: AppEnv | null = null;

/**
 * Lazily validates and returns server-side environment configuration.
 * Validation runs at call time so `next build` succeeds without runtime secrets.
 */
export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });

  if (!parsed.success) {
    const formatted = z.flattenError(parsed.error);
    throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted.fieldErrors)}`);
  }

  const data = parsed.data;
  const resolvedAppUrl = data.APP_URL ?? 'http://localhost:3000';
  const defaultLogLevel = data.APP_ENV === 'development' ? 'debug' : 'info';

  cachedEnv = {
    APP_ENV: data.APP_ENV,
    APP_URL: resolvedAppUrl,
    DATABASE_URL: data.DATABASE_URL,
    SESSION_SECRET: data.SESSION_SECRET,
    RESEND_API_KEY: data.RESEND_API_KEY,
    EMAIL_FROM: data.EMAIL_FROM,
    LOG_LEVEL: data.LOG_LEVEL ?? defaultLogLevel,
  };

  return cachedEnv;
}

/**
 * Clears cached environment values (primarily for unit tests).
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}

/**
 * Lazy runtime guard for database-dependent phases.
 */
export function requireDatabaseUrl(): string {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required to access PostgreSQL.');
  }
  return DATABASE_URL;
}

/**
 * Lazy runtime guard for authentication and token-sealing phases.
 */
export function requireSessionSecret(): string {
  const { SESSION_SECRET } = getEnv();
  if (!SESSION_SECRET) {
    throw new Error(
      'SESSION_SECRET environment variable (min 32 characters) is required for sessions.',
    );
  }
  return SESSION_SECRET;
}
