import type { TTimeDimension } from "@formbricks/types/analysis";

/**
 * Most time buckets one chart may span. A chart grouped by a time granularity gets one row per bucket
 * in its date range, including the empty ones, and those rows are built in the web process — so the
 * bucket count, not the data, is what a query costs there (ENG-6603). 10,000 keeps every range the app
 * offers at its finest granularity (a year by the hour is 8,784) and costs a few megabytes; a range past
 * it needs a coarser granularity.
 */
export const MAX_TIME_BUCKETS = 10_000;

export type TTimeBucketGranularity = NonNullable<TTimeDimension["granularity"]>;

const TIME_BUCKET_GRANULARITIES: readonly string[] = [
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
] satisfies readonly TTimeBucketGranularity[];

/** Cube also takes custom granularities by name; only the built-in ones can be counted here. */
export const isTimeBucketGranularity = (value: string): value is TTimeBucketGranularity =>
  TIME_BUCKET_GRANULARITIES.includes(value);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** 1970-01-01 is a Thursday; weeks start on Monday (ISO), three days earlier. */
const WEEK_START_OFFSET_MS = 3 * DAY_MS;

const FIXED_LENGTH_MS: Partial<Record<TTimeBucketGranularity, number>> = {
  second: SECOND_MS,
  minute: MINUTE_MS,
  hour: HOUR_MS,
  day: DAY_MS,
};

/**
 * A range bound as epoch milliseconds, read as UTC: a calendar date covers its whole day, and a
 * date-time without an offset (Cube's shape) is taken as written.
 */
const toEpochMs = (value: string, edge: "start" | "end"): number => {
  if (DATE_ONLY.test(value)) {
    return Date.parse(`${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
  }
  return Date.parse(HAS_ZONE.test(value) ? value : `${value}Z`);
};

const monthIndex = (date: Date): number => date.getUTCFullYear() * 12 + date.getUTCMonth();

/** Buckets between two instants (epoch milliseconds, `from` ≤ `to`), counted in UTC. */
const countBucketsBetween = (from: number, to: number, granularity: TTimeBucketGranularity): number => {
  const fixed = FIXED_LENGTH_MS[granularity];
  if (fixed !== undefined) return Math.floor(to / fixed) - Math.floor(from / fixed) + 1;

  if (granularity === "week") {
    return (
      Math.floor((to + WEEK_START_OFFSET_MS) / WEEK_MS) -
      Math.floor((from + WEEK_START_OFFSET_MS) / WEEK_MS) +
      1
    );
  }

  const first = new Date(from);
  const last = new Date(to);
  if (granularity === "month") return monthIndex(last) - monthIndex(first) + 1;
  if (granularity === "quarter")
    return Math.floor(monthIndex(last) / 3) - Math.floor(monthIndex(first) / 3) + 1;
  return last.getUTCFullYear() - first.getUTCFullYear() + 1;
};

/**
 * How many `granularity` buckets the range `[start, end]` touches, by arithmetic alone — nothing is
 * allocated, so it is safe on any range. Bounds are calendar dates or ISO date-times. Buckets are
 * counted in UTC; the organization's time zone shifts the real count by at most one. An unreadable
 * bound counts as infinitely many, so a caller that caps on this never lets one through.
 */
export const countTimeBuckets = (start: string, end: string, granularity: TTimeBucketGranularity): number => {
  const from = toEpochMs(start, "start");
  const to = toEpochMs(end, "end");
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
  if (to < from) return 0;
  return countBucketsBetween(from, to, granularity);
};

/**
 * How many `granularity` buckets lie between the earliest and the latest of `values` — the span a
 * chart without a date range is filled over. Compared as instants, not as strings, so an extended
 * year (`+010000-…`) cannot sort itself out of the span. Empty values are skipped, as the Cube client
 * skips them; any other value that is not a readable date-time counts as infinitely many buckets.
 */
export const countTimeBucketsSpanning = (
  values: readonly unknown[],
  granularity: TTimeBucketGranularity
): number => {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const instant = typeof value === "string" ? toEpochMs(value, "start") : Number.NaN;
    if (!Number.isFinite(instant)) return Number.POSITIVE_INFINITY;
    first = Math.min(first, instant);
    last = Math.max(last, instant);
  }
  return first <= last ? countBucketsBetween(first, last, granularity) : 0;
};
