import { Temporal } from '@js-temporal/polyfill';

import { ValidationError } from '@/lib/errors';

const RAW_OFFSET_PATTERN = /^[+-]\d{2}(?::?\d{2})?$/;

export function isValidIanaTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed || RAW_OFFSET_PATTERN.test(trimmed)) {
    return false;
  }

  try {
    Temporal.PlainDate.from('2026-01-01').toZonedDateTime(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function assertValidIanaTimeZone(timeZone: string): string {
  const trimmed = timeZone.trim();
  if (!isValidIanaTimeZone(trimmed)) {
    throw new ValidationError('INVALID_TIMEZONE', `Invalid IANA timezone: ${timeZone}`);
  }
  return trimmed;
}

export type LocalDateTimeClassification =
  | { kind: 'unique'; zoned: Temporal.ZonedDateTime }
  | { kind: 'ambiguous'; earlier: Temporal.ZonedDateTime; later: Temporal.ZonedDateTime }
  | {
      kind: 'nonexistent';
      earlier: Temporal.ZonedDateTime;
      later: Temporal.ZonedDateTime;
      transition: Temporal.ZonedDateTime | null;
    };

export function classifyLocalDateTime(
  pdt: Temporal.PlainDateTime,
  timeZone: string,
): LocalDateTimeClassification {
  assertValidIanaTimeZone(timeZone);

  try {
    const zoned = pdt.toZonedDateTime(timeZone, { disambiguation: 'reject' });
    return { kind: 'unique', zoned };
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }

    const earlier = pdt.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
    const later = pdt.toZonedDateTime(timeZone, { disambiguation: 'later' });

    if (earlier.toPlainDateTime().equals(pdt) && later.toPlainDateTime().equals(pdt)) {
      return { kind: 'ambiguous', earlier, later };
    }

    const transition = earlier.getTimeZoneTransition('next');
    return { kind: 'nonexistent', earlier, later, transition };
  }
}
