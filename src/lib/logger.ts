import 'server-only';

import pino, { type Logger } from 'pino';

import { getEnv } from '@/lib/config/env';

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'password_hash',
  'newPassword',
  'authorization',
  'cookie',
  'cookies',
  'setCookie',
  'sessionToken',
  'session_token',
  'token',
  'tokenHash',
  'token_hash',
  'managementToken',
  'management_token',
  'managementTokenHash',
  'management_token_hash',
  'managementUrl',
  'management_url',
  'sealedManagementToken',
  'apiKey',
  'api_key',
  'resendApiKey',
  'RESEND_API_KEY',
  'SESSION_SECRET',
  'secret',
  'guestEmail',
  'guest_email',
  'guestName',
  'guest_name',
  'email',
  'name',
  'ip',
  'ipAddress',
  'ip_address',
] as const;

const REDACT_PATHS: string[] = [
  ...SENSITIVE_FIELDS,
  ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
  ...SENSITIVE_FIELDS.map((field) => `*.*.${field}`),
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers["set-cookie"]',
];

let rootLogger: Logger | null = null;

function createLogger(): Logger {
  const env = getEnv();

  return pino({
    level: env.LOG_LEVEL,
    base: {
      service: 'slotbook',
      env: env.APP_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
  });
}

export function getLogger(): Logger {
  if (!rootLogger) {
    rootLogger = createLogger();
  }
  return rootLogger;
}

export function withRequestLogger(requestId: string, context?: Record<string, unknown>): Logger {
  return getLogger().child({
    requestId,
    ...context,
  });
}
