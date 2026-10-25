import { ybpToCalendarYear } from "../shared/time";
import type { Locale } from "../shared/types";

const numberFormatCache = new Map<Locale, Intl.NumberFormat>();
const sourceMonthIndexes = new Map([
  ["jan", 0],
  ["feb", 1],
  ["mar", 2],
  ["apr", 3],
  ["may", 4],
  ["jun", 5],
  ["jul", 6],
  ["aug", 7],
  ["sep", 8],
  ["oct", 9],
  ["nov", 10],
  ["dec", 11],
]);

export function formatCalendar(ybp: number, locale: Locale, formatNumber: (value: number) => string): string {
  const year = ybpToCalendarYear(ybp);
  if (locale === "ru") {
    if (year < 0) return `${formatNumber(Math.abs(year))} до н. э.`;
    return `${formatNumber(year)} н. э.`;
  }
  if (year < 0) return `${formatNumber(Math.abs(year))} BCE`;
  return `${formatNumber(year)} CE`;
}

export function formatDate(value: string, locale: Locale = "ru"): string {
  const parsed = parseSourceDate(value);
  if (!parsed) return value;
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  return new Intl.DateTimeFormat(dateLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed.date).replace(/\s*г\.$/u, "");
}

export function formatMachineDate(value: string): string | null {
  const parsed = parseSourceDate(value);
  if (!parsed) return null;
  return parsed.dateOnly
    ? parsed.date.toISOString().slice(0, 10)
    : parsed.date.toISOString();
}

export function parseInteger(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export function formatNumber(value: number, locale: Locale): string {
  const cached = numberFormatCache.get(locale);
  if (cached) return cached.format(value);

  const numberLocale = locale === "ru" ? "ru-RU" : "en-US";
  const formatter = new Intl.NumberFormat(numberLocale);
  numberFormatCache.set(locale, formatter);
  return formatter.format(value);
}

export function csvCell(value: string): string {
  // Spreadsheet applications may execute cells that start with a formula
  // marker, including after leading whitespace. Export every upstream label as
  // text while preserving its visible value.
  const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
  if (!/[",\r\n]/.test(safeValue)) return safeValue;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function parseSourceDate(value: string): { date: Date; dateOnly: boolean } | null {
  const trimmed = value.trim();
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDate) {
    const date = createUtcDate(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
    return date ? { date, dateOnly: true } : null;
  }

  const sourceDate = /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/.exec(trimmed);
  if (sourceDate) {
    const month = sourceMonthIndexes.get(sourceDate[1].toLowerCase());
    if (month === undefined) return null;
    const date = createUtcDate(Number(sourceDate[3]), month, Number(sourceDate[2]));
    return date ? { date, dateOnly: true } : null;
  }

  const timestamp = new Date(trimmed);
  return Number.isNaN(timestamp.getTime()) ? null : { date: timestamp, dateOnly: false };
}

function createUtcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}
