import { isValid, parseISO } from "date-fns";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { TIME_GRANULARITIES, type TimeGranularity } from "@/modules/ee/analysis/lib/schema-definition";

/** Narrowest slot (px) a time-axis label gets before ticks are thinned out. Fits the widest compact
 * label ("Sep 14, 1:00 PM") wrapped onto two lines, so neighbouring labels never touch. */
export const TIME_AXIS_MIN_TICK_WIDTH = 72;

// Cube returns time buckets as wall-clock strings in the reporting time zone, without an offset
// ("2026-09-14T13:00:00.000"). Parsing them as local time and formatting them without a `timeZone`
// keeps that wall clock as-is; converting would shift the bucket to the viewer's zone.
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

const parseTimeBucket = (value: unknown): Date | null => {
  if (typeof value !== "string" || !ISO_DATE_PREFIX.test(value)) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
};

/** The granularity a Cube time column is bucketed by (`FeedbackRecords.collectedAt.hour` → "hour"). */
export const getTimeGranularityFromKey = (key: string): TimeGranularity | undefined =>
  TIME_GRANULARITIES.find((granularity) => key.endsWith(`.${granularity}`));

const FULL_LABEL_OPTIONS: Record<TimeGranularity, Intl.DateTimeFormatOptions> = {
  hour: { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  day: { year: "numeric", month: "short", day: "numeric" },
  week: { year: "numeric", month: "short", day: "numeric" },
  month: { year: "numeric", month: "short" },
  quarter: { year: "numeric", month: "short" },
  year: { year: "numeric" },
};

/** Full label for one time bucket, as the tooltip header shows it: an hourly bucket keeps its time
 * ("Sep 14, 2026, 1:00 PM") instead of collapsing to the date every bucket of that day shares. */
export const formatTimeBucket = (value: unknown, granularity: TimeGranularity, locale: string): string => {
  const date = parseTimeBucket(value);
  if (!date) return typeof value === "string" || typeof value === "number" ? String(value) : "";
  return granularity === "hour"
    ? formatDateTimeForDisplay(date, locale, FULL_LABEL_OPTIONS.hour)
    : formatDateForDisplay(date, locale, FULL_LABEL_OPTIONS[granularity]);
};

export interface TTimeAxisTickLayout {
  /** Buckets per labelled tick: 1 labels every bucket, 3 every third one. */
  step: number;
  /** Index of the first and last labelled bucket. */
  first: number;
  last: number;
  /** Room (px) each label owns: `step` buckets' worth of axis. */
  slotWidth: number;
}

/**
 * Which buckets of a time axis get a label, so each label owns at least `minTickWidth` px.
 *
 * Thinned out (`step` > 1), a label is always centred on its bucket and owns `step` buckets of room,
 * so the first and last labelled buckets are moved in from the plot edges until half that room fits
 * (a point scale puts the outer buckets on the edge, a band scale half a bucket inside it). Nothing
 * is clipped and nothing needs anchoring. At `step` 1 every bucket is labelled and the caller keeps
 * its own edge handling.
 */
export const getTimeAxisTickLayout = (
  tickCount: number,
  axisWidth: number,
  pointScale: boolean,
  minTickWidth: number = TIME_AXIS_MIN_TICK_WIDTH
): TTimeAxisTickLayout => {
  const band = tickCount > 0 ? axisWidth / tickCount : axisWidth;
  const unthinned = { step: 1, first: 0, last: tickCount - 1, slotWidth: band };
  if (tickCount <= 1 || axisWidth <= 0) return unthinned;

  const bucketWidth = pointScale ? axisWidth / (tickCount - 1) : band;
  const step = Math.ceil(minTickWidth / bucketWidth);
  if (step <= 1) return unthinned;

  const slotWidth = step * bucketWidth;
  const edgeInset = pointScale ? 0 : bucketWidth / 2;
  // Buckets to skip at each edge before a centred label's half-slot fits inside the plot.
  const edgeBuckets = Math.ceil(Math.max(0, slotWidth / 2 - edgeInset) / bucketWidth);
  const first = Math.min(edgeBuckets, tickCount - 1);
  const lastAllowed = tickCount - 1 - edgeBuckets;
  const last = lastAllowed < first ? first : first + Math.floor((lastAllowed - first) / step) * step;
  return { step, first, last, slotWidth };
};

const isLabelled = (index: number, { step, first, last }: TTimeAxisTickLayout) =>
  index >= first && index <= last && (index - first) % step === 0;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Compact labels for the buckets `layout` labels; the others are `null`.
 *
 * A label only repeats the context its predecessor already set when that context changes: hourly
 * ticks read "1:00 PM", and carry the date on the first tick and wherever the day turns over; daily
 * and weekly ticks read "Sep 14" and carry the year on the first tick and at the new year. Values
 * that aren't time buckets fall back to their raw text.
 */
export const getTimeAxisTickLabels = (
  values: unknown[],
  granularity: TimeGranularity,
  locale: string,
  layout: TTimeAxisTickLayout
): (string | null)[] => {
  let previous: Date | null = null;
  return values.map((value, index) => {
    if (!isLabelled(index, layout)) return null;
    const date = parseTimeBucket(value);
    if (!date) {
      previous = null;
      return typeof value === "string" || typeof value === "number" ? String(value) : "";
    }
    const prior = previous;
    previous = date;

    switch (granularity) {
      case "hour": {
        const time: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
        return prior && isSameDay(prior, date)
          ? formatDateTimeForDisplay(date, locale, time)
          : formatDateTimeForDisplay(date, locale, { month: "short", day: "numeric", ...time });
      }
      case "day":
      case "week":
        return prior && prior.getFullYear() === date.getFullYear()
          ? formatDateForDisplay(date, locale, { month: "short", day: "numeric" })
          : formatDateForDisplay(date, locale, FULL_LABEL_OPTIONS.day);
      default:
        return formatDateForDisplay(date, locale, FULL_LABEL_OPTIONS[granularity]);
    }
  });
};
