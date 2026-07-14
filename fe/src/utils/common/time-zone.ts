import type { TimeZoneOption } from '@/@types/common/utils/time-zone';

export type { TimeZoneOption };

export interface TimeZoneDateParts {
  year: number;
  month: number;
  day: number;
}

const DEFAULT_TIME_ZONE = 'UTC';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getSystemTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
    );
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getDateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getParts(date: Date, timeZone = getSystemTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function getDateKeyInTimeZone(date: Date, timeZone?: string): string {
  const parts = getParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getDatePartsInTimeZone(
  date: Date,
  timeZone?: string
): TimeZoneDateParts {
  const parts = getParts(date, timeZone);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

export function getTimePartsInTimeZone(date: Date, timeZone?: string) {
  const parts = getParts(date, timeZone);
  return { hour: Number(parts.hour), minute: Number(parts.minute) };
}

export function getWeekdayIndexInTimeZone(
  date: Date,
  timeZone?: string
): number {
  const weekday = getParts(date, timeZone).weekday?.toLowerCase().slice(0, 3);
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(
    weekday ?? ''
  );
}

export function createDateInTimeZone(
  parts: TimeZoneDateParts & { hour: number; minute: number },
  timeZone: string
): Date {
  const desiredUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );
  let result = desiredUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getParts(new Date(result), timeZone);
    const actualUtc = Date.UTC(
      Number(actual.year),
      Number(actual.month) - 1,
      Number(actual.day),
      Number(actual.hour),
      Number(actual.minute)
    );
    result += desiredUtc - actualUtc;
  }

  return new Date(result);
}

export function formatTimeInTimeZone(
  date: Date,
  timeZone: string | undefined,
  locale: string
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timeZone ?? getSystemTimeZone(),
    hour: 'numeric',
    minute: '2-digit',
    numberingSystem: 'latn'
  }).format(date);
}

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_PARTS_LOCALE = 'en-US-u-nu-latn';
const PALESTINE_TIME_ZONE_VALUE = 'Asia/Palestine';
const PALESTINE_TIME_ZONE_BACKING = 'Asia/Jerusalem';
const OFFSET_LABEL_REGEX = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/;
const NORMALIZED_OFFSET_LABEL_REGEX = /^GMT([+-])(\d{2}):(\d{2})$/;
const MAX_TIME_ZONE_OPTIONS_CACHE_SIZE = 24;

const cachedOptionsByKey = new Map<string, TimeZoneOption[]>();
const canonicalTimeZoneCache = new Map<string, string | null>();
let cachedSupportedTimeZones: string[] | null = null;

function resolveLocale(locale?: string): string {
  return locale ?? DEFAULT_LOCALE;
}

function compareByLocale(left: string, right: string, locale: string): number {
  return left.localeCompare(right, locale, { sensitivity: 'base' });
}

function normalizeOffsetLabel(rawLabel: string | null): string {
  if (!rawLabel) return 'GMT+00:00';

  const normalized = rawLabel
    .replace('UTC', 'GMT')
    .replace('\u2212', '-')
    .trim();
  if (normalized === 'GMT') return 'GMT+00:00';

  const match = normalized.match(OFFSET_LABEL_REGEX);
  if (!match) return 'GMT+00:00';

  const sign = match[1];
  const hours = match[2]?.padStart(2, '0') ?? '00';
  const minutes = (match[3] ?? '00').padStart(2, '0');

  return `GMT${sign}${hours}:${minutes}`;
}

function offsetMinutesFromLabel(offsetLabel: string): number {
  const match = offsetLabel.match(NORMALIZED_OFFSET_LABEL_REGEX);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  return sign * (hours * 60 + minutes);
}

function compactOffsetLabel(offsetLabel: string): string {
  const match = offsetLabel.match(NORMALIZED_OFFSET_LABEL_REGEX);
  if (!match) return offsetLabel;

  const sign = match[1];
  const hour = String(Number(match[2]));
  const minutes = match[3];

  return minutes === '00'
    ? `GMT${sign}${hour}`
    : `GMT${sign}${hour}:${minutes}`;
}

function getCanonicalTimeZone(
  timeZone: string | null | undefined
): string | null {
  if (!timeZone) {
    return null;
  }
  if (canonicalTimeZoneCache.has(timeZone)) {
    return canonicalTimeZoneCache.get(timeZone) ?? null;
  }

  const lookupTimeZone =
    timeZone === PALESTINE_TIME_ZONE_VALUE
      ? PALESTINE_TIME_ZONE_BACKING
      : timeZone;

  try {
    const canonicalTimeZone = new Intl.DateTimeFormat(DEFAULT_PARTS_LOCALE, {
      timeZone: lookupTimeZone
    }).resolvedOptions().timeZone;

    canonicalTimeZoneCache.set(timeZone, canonicalTimeZone);

    return canonicalTimeZone;
  } catch {
    canonicalTimeZoneCache.set(timeZone, null);

    return null;
  }
}

function cacheSupportedTimeZones(timeZones: string[]): string[] {
  cachedSupportedTimeZones = timeZones;

  return [...timeZones];
}

function getSupportedTimeZones(): string[] {
  if (cachedSupportedTimeZones) {
    return [...cachedSupportedTimeZones];
  }

  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: 'timeZone') => string[];
    }
  ).supportedValuesOf;

  if (typeof supportedValuesOf === 'function') {
    try {
      const supported = supportedValuesOf('timeZone');
      if (supported.length > 0) {
        return cacheSupportedTimeZones(supported);
      }
    } catch {
      void 0;
    }
  }

  const systemTimeZone = getSystemTimeZone();

  return cacheSupportedTimeZones(
    systemTimeZone === DEFAULT_TIME_ZONE
      ? [DEFAULT_TIME_ZONE]
      : [DEFAULT_TIME_ZONE, systemTimeZone]
  );
}

function getTimeZoneOffsetLabel(
  timeZone: string,
  date: Date = new Date()
): string {
  try {
    const parts = new Intl.DateTimeFormat(DEFAULT_PARTS_LOCALE, {
      timeZone: getCanonicalTimeZone(timeZone) ?? timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset'
    }).formatToParts(date);
    const offset =
      parts.find((part) => part.type === 'timeZoneName')?.value ?? null;

    return normalizeOffsetLabel(offset);
  } catch {
    return 'GMT+00:00';
  }
}

function getTimeZoneCity(timeZone: string): string {
  const city = timeZone.split('/').at(-1) ?? timeZone;

  return city.replace(/_/g, ' ');
}

function getTimeZoneLongName(
  timeZone: string,
  date: Date = new Date(),
  locale?: string
): string {
  try {
    const parts = new Intl.DateTimeFormat(resolveLocale(locale), {
      timeZone: getCanonicalTimeZone(timeZone) ?? timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'long'
    }).formatToParts(date);
    const longName = parts.find((part) => part.type === 'timeZoneName')?.value;

    return longName || timeZone;
  } catch {
    return timeZone;
  }
}

const PALESTINE_LONG_NAME_FALLBACK = {
  ar: 'توقيت فلسطين',
  other: 'Palestine Time'
} as const;

function buildPalestineLongName(date: Date, locale: string): string {
  const israelLongName = getTimeZoneLongName(
    PALESTINE_TIME_ZONE_BACKING,
    date,
    locale
  );

  if (locale.startsWith('ar')) {
    return israelLongName.includes('إسرائيل')
      ? israelLongName.replace('إسرائيل', 'فلسطين')
      : PALESTINE_LONG_NAME_FALLBACK.ar;
  }

  return israelLongName.includes('Israel')
    ? israelLongName.replace('Israel', 'Palestine')
    : PALESTINE_LONG_NAME_FALLBACK.other;
}

function buildPalestineTimeZoneOption(
  date: Date,
  locale: string
): TimeZoneOption {
  const offsetLabel = getTimeZoneOffsetLabel(PALESTINE_TIME_ZONE_BACKING, date);
  const compactLabel = compactOffsetLabel(offsetLabel);
  const longName = buildPalestineLongName(date, locale);
  const city = locale.startsWith('ar') ? 'فلسطين' : 'Palestine';

  return {
    value: PALESTINE_TIME_ZONE_VALUE,
    offsetLabel,
    compactOffsetLabel: compactLabel,
    offsetMinutes: offsetMinutesFromLabel(offsetLabel),
    longName,
    city,
    searchLabel:
      `${offsetLabel} ${compactLabel} ${longName} palestine فلسطين ${PALESTINE_TIME_ZONE_VALUE}`.toLowerCase()
  };
}

export function getTimeZoneOptions(
  params: { date?: Date; locale?: string } = {}
): TimeZoneOption[] {
  const date = params.date ?? new Date();
  const locale = resolveLocale(params.locale);

  const cacheKey = `${locale}|${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  const cached = cachedOptionsByKey.get(cacheKey);
  if (cached) {
    return cached;
  }

  const options = getSupportedTimeZones()
    .map((timeZone) => {
      const offsetLabel = getTimeZoneOffsetLabel(timeZone, date);
      const offsetMinutes = offsetMinutesFromLabel(offsetLabel);
      const longName = getTimeZoneLongName(timeZone, date, locale);
      const city = getTimeZoneCity(timeZone);
      const compactLabel = compactOffsetLabel(offsetLabel);

      return {
        value: timeZone,
        offsetLabel,
        compactOffsetLabel: compactLabel,
        offsetMinutes,
        longName,
        city,
        searchLabel:
          `${offsetLabel} ${compactLabel} ${longName} ${city} ${timeZone}`.toLowerCase()
      } satisfies TimeZoneOption;
    })
    .concat(buildPalestineTimeZoneOption(date, locale))
    .sort(
      (a, b) =>
        a.offsetMinutes - b.offsetMinutes ||
        compareByLocale(a.longName, b.longName, locale) ||
        compareByLocale(a.city, b.city, locale) ||
        compareByLocale(a.value, b.value, locale)
    );

  if (cachedOptionsByKey.size >= MAX_TIME_ZONE_OPTIONS_CACHE_SIZE) {
    cachedOptionsByKey.clear();
  }

  cachedOptionsByKey.set(cacheKey, options);

  return options;
}
