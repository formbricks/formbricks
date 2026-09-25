import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { TIME_GRANULARITIES, type TimeGranularity } from "@/modules/ee/analysis/lib/schema-definition";

/** Narrowest slot (px) a time-axis label gets before ticks are thinned out. Fits the widest compact
 * label ("Sep 14, 1:00 PM") wrapped onto two lines, so neighbouring labels never touch. */
export const TIME_AXIS_MIN_TICK_WIDTH = 72;

// Cube returns time buckets as wall-clock strings in the reporting time zone, without an offset
// ("2026-09-14T13:00:00.000"). The fields are read into a UTC date and every format and comparison
// runs in UTC, so the wall clock comes out exactly as Cube sent it. Local time would shift it to the
// viewer's zone, or skip an hour that falls in the viewer's daylight-saving gap.
const TIME_BUCKET = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;
const BUCKET_TIME_ZONE = "UTC";

const parseTimeBucket = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const match = TIME_BUCKET.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Date.UTC rolls an out-of-range field over ("2026-02-30" → Mar 2); treat that as not a bucket.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

const inBucketZone = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({
  ...options,
  timeZone: BUCKET_TIME_ZONE,
});

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
    ? formatDateTimeForDisplay(date, locale, inBucketZone(FULL_LABEL_OPTIONS.hour))
    : formatDateForDisplay(date, locale, inBucketZone(FULL_LABEL_OPTIONS[granularity]));
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
  const first = edgeBuckets;
  const lastAllowed = tickCount - 1 - edgeBuckets;
  if (lastAllowed < first) {
    // Too narrow for any bucket to hold a full slot clear of both edges: label only the middle
    // bucket, with a slot shrunk to the room it has to the nearer edge.
    const middle = Math.floor((tickCount - 1) / 2);
    const room = Math.min(middle, tickCount - 1 - middle) * bucketWidth + edgeInset;
    return { step, first: middle, last: middle, slotWidth: 2 * room };
  }
  const last = first + Math.floor((lastAllowed - first) / step) * step;
  return { step, first, last, slotWidth };
};

const isLabelled = (index: number, { step, first, last }: TTimeAxisTickLayout) =>
  index >= first && index <= last && (index - first) % step === 0;

const isSameDay = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

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
          ? formatDateTimeForDisplay(date, locale, inBucketZone(time))
          : formatDateTimeForDisplay(date, locale, inBucketZone({ month: "short", day: "numeric", ...time }));
      }
      case "day":
      case "week":
        return prior?.getUTCFullYear() === date.getUTCFullYear()
          ? formatDateForDisplay(date, locale, inBucketZone({ month: "short", day: "numeric" }))
          : formatDateForDisplay(date, locale, inBucketZone(FULL_LABEL_OPTIONS.day));
      default:
        return formatDateForDisplay(date, locale, inBucketZone(FULL_LABEL_OPTIONS[granularity]));
    }
  });
};
