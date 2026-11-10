import { z } from 'zod';

const emptyStringToUndefined = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

const optionalNonEmptyString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
  }
  return false;
}, z.boolean());

const FORBIDDEN_PROD_SECRET_MARKERS = [
  'replace-with',
  'dev-secret',
  'changeme',
  'insecure',
  'example',
] as const;

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
    ALLOW_DEMO_SEED: booleanFromEnv,
    DEMO_HOST_EMAIL: z.preprocess(emptyStringToUndefined, z.email().optional()),
    DEMO_HOST_PASSWORD: z.preprocess(emptyStringToUndefined, z.string().min(12).optional()),
  })
  .superRefine((data, ctx) => {
    if (data.APP_ENV === 'production') {
      if (!data.APP_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['APP_URL'],
          message: 'APP_URL is required when APP_ENV=production',
        });
      }
      if (data.SESSION_SECRET) {
        const lower = data.SESSION_SECRET.toLowerCase();
        if (FORBIDDEN_PROD_SECRET_MARKERS.some((marker) => lower.includes(marker))) {
          ctx.addIssue({
            code: 'custom',
            path: ['SESSION_SECRET'],
            message: 'SESSION_SECRET appears to use a placeholder/insecure value in production',
          });
        }
      }
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
  ALLOW_DEMO_SEED: boolean;
  DEMO_HOST_EMAIL: string | undefined;
  DEMO_HOST_PASSWORD: string | undefined;
}

let cachedEnv: AppEnv | null = null;

/**
 * Lazily parses and validates runtime environment variables.
 * Calling on-demand prevents `next build` failures when runtime secrets are absent.
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
    ALLOW_DEMO_SEED: process.env.ALLOW_DEMO_SEED,
    DEMO_HOST_EMAIL: process.env.DEMO_HOST_EMAIL,
    DEMO_HOST_PASSWORD: process.env.DEMO_HOST_PASSWORD,
  });

  if (!parsed.success) {
    const formatted = z.flattenError(parsed.error);
    throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted.fieldErrors)}`);
  }

  const data = parsed.data;
  const defaultLogLevel = data.APP_ENV === 'development' ? 'debug' : 'info';

  cachedEnv = {
    APP_ENV: data.APP_ENV,
    APP_URL: data.APP_URL ?? 'http://localhost:3000',
    DATABASE_URL: data.DATABASE_URL,
    SESSION_SECRET: data.SESSION_SECRET,
    RESEND_API_KEY: data.RESEND_API_KEY,
    EMAIL_FROM: data.EMAIL_FROM,
    LOG_LEVEL: data.LOG_LEVEL ?? defaultLogLevel,
    ALLOW_DEMO_SEED: data.ALLOW_DEMO_SEED,
    DEMO_HOST_EMAIL: data.DEMO_HOST_EMAIL,
    DEMO_HOST_PASSWORD: data.DEMO_HOST_PASSWORD,
  };

  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

export function requireDatabaseUrl(): string {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required to access PostgreSQL.');
  }
  return DATABASE_URL;
}

export function requireSessionSecret(): string {
  const { SESSION_SECRET } = getEnv();
  if (!SESSION_SECRET) {
    throw new Error(
      'SESSION_SECRET environment variable (min 32 characters) is required for sessions.',
    );
  }
  return SESSION_SECRET;
}
