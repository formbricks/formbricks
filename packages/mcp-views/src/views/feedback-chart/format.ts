import type { CellValue, Granularity } from "./model";

/** Locale and zone the host reports (`hostContext.locale`, `hostContext.timeZone`). Both are optional. */
export interface FormatContext {
  locale?: string;
  timeZone?: string;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

const numberFormat = (locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    try {
      format = new Intl.NumberFormat(locale, options);
    } catch {
      // A locale the runtime does not know falls back to its default rather than breaking the chart.
      format = new Intl.NumberFormat(undefined, options);
    }
    numberFormats.set(key, format);
  }
  return format;
};

const dateFormat = (
  locale: string | undefined,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  const key = `${locale ?? ""}|${timeZone ?? ""}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    } catch {
      format = new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" });
    }
    dateFormats.set(key, format);
  }
  return format;
};

/** 1,234.56: the full value, for tooltips and tables. */
export const formatFull = (value: number, locale?: string): string =>
  numberFormat(locale, { maximumFractionDigits: 2 }).format(value);

/** 31.5, 1.2K, 3.4M: the short form for labels, with the full value one hover away. */
export const formatCompact = (value: number, locale?: string): string =>
  numberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);

/** Decimal places needed to write `step` exactly (0.25 needs two), at most three. */
const decimalsOf = (step: number): number => {
  for (let digits = 0; digits < 3; digits += 1) {
    const scaled = step * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return digits;
  }
  return 3;
};

/**
 * An axis tick. The fraction digits follow the tick step (0.25 needs two), so neighbouring ticks never
 * round to the same text; from 1,000 up the compact form takes over.
 */
export const formatTick = (value: number, step: number, locale?: string): string => {
  if (Math.abs(value) >= 1000) return formatCompact(value, locale);
  const digits = decimalsOf(step);
  return numberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
};

export const formatPercent = (share: number, locale?: string): string =>
  numberFormat(locale, { style: "percent", maximumFractionDigits: share < 0.1 ? 1 : 0 }).format(share);

/** What a bucket timestamp means. Cube answers bucket starts as zone-less wall-clock text. */
export interface TimePoint {
  ms: number;
  /** Zone-less text is already a calendar label in the organization's reporting zone: shown as is. */
  naive: boolean;
}

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

export const parseTimestamp = (value: CellValue): TimePoint | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const text = value.trim();
  const naive = !HAS_ZONE.test(text);
  const ms = Date.parse(naive ? `${text.replace(" ", "T")}Z` : text);
  return Number.isNaN(ms) ? undefined : { ms, naive };
};

const zoneFor = (point: TimePoint, context: FormatContext): string | undefined =>
  point.naive ? "UTC" : context.timeZone;

const quarterOf = (month: number): number => Math.floor(month / 3) + 1;

/** Short axis text for a bucket. `withYear` is set when the axis spans more than one year. */
export const formatTimeLabel = (
  point: TimePoint,
  granularity: Granularity,
  context: FormatContext,
  withYear: boolean
): string => {
  const date = new Date(point.ms);
  const zone = zoneFor(point, context);
  switch (granularity) {
    case "hour":
      return dateFormat(context.locale, zone, { month: "short", day: "numeric", hour: "numeric" }).format(
        date
      );
    case "day":
    case "week":
      return dateFormat(context.locale, zone, {
        month: "short",
        day: "numeric",
        ...(withYear ? { year: "2-digit" } : {}),
      }).format(date);
    case "month":
      return dateFormat(context.locale, zone, {
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
      }).format(date);
    case "quarter":
      return `Q${quarterOf(date.getUTCMonth())} ${date.getUTCFullYear()}`;
    case "year":
      return String(date.getUTCFullYear());
  }
};

/** Long form for tooltips and tables. */
export const formatTimeFull = (
  point: TimePoint,
  granularity: Granularity,
  context: FormatContext
): string => {
  const date = new Date(point.ms);
  const zone = zoneFor(point, context);
  switch (granularity) {
    case "hour":
      return dateFormat(context.locale, zone, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    case "day":
      return dateFormat(context.locale, zone, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
    case "week":
      return `Week of ${dateFormat(context.locale, zone, { year: "numeric", month: "short", day: "numeric" }).format(date)}`;
    case "month":
      return dateFormat(context.locale, zone, { year: "numeric", month: "long" }).format(date);
    case "quarter":
      return `Q${quarterOf(date.getUTCMonth())} ${date.getUTCFullYear()}`;
    case "year":
      return String(date.getUTCFullYear());
  }
};

/** A calendar date typed in a query (`2026-01-31`) as text, with no zone shift. */
export const formatCalendarDate = (value: string, context: FormatContext): string => {
  const point = parseTimestamp(value);
  if (!point) return value;
  return dateFormat(context.locale, "UTC", { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(point.ms)
  );
};

const SENTIMENT_LABELS: Record<string, string> = {
  very_negative: "Very negative",
  negative: "Negative",
  neutral: "Neutral",
  positive: "Positive",
  very_positive: "Very positive",
  mixed: "Mixed",
};

const VALUE_BAND_LABELS: Record<string, string> = {
  promoter: "Promoters",
  passive: "Passives",
  detractor: "Detractors",
  satisfied: "Satisfied",
  neutral: "Neutral",
  dissatisfied: "Dissatisfied",
};

const emptyLabel = (columnId: string): string => {
  if (columnId === "FeedbackRecords.sentiment" || columnId === "FeedbackRecords.emotions") {
    return "Not enriched";
  }
  if (columnId === "FeedbackRecords.language") return "Unspecified";
  return "None";
};

/**
 * A grouping value as text a person reads. Empty buckets are real groups and get a name; the enum
 * tokens the analytics service emits become sentence case. Anything else is the value as it came.
 */
export const humanizeValue = (columnId: string, value: CellValue, locale?: string): string => {
  if (value === null) return emptyLabel(columnId);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatFull(value, locale);
  const text = value.replace(/\s+/g, " ").trim();
  if (text === "") return emptyLabel(columnId);
  if (columnId === "FeedbackRecords.sentiment") return SENTIMENT_LABELS[text] ?? text;
  if (columnId === "FeedbackRecords.valueBand") return VALUE_BAND_LABELS[text] ?? text;
  return text;
};
