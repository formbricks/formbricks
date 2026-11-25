import { addDays, differenceInCalendarDays, subMonths } from "date-fns";
import { z } from "zod";
import { getCalendarDayInTimeZone } from "@/lib/date-ranges";
import { formatLocalDay } from "@/lib/utils/datetime";

/**
 * Relative date ranges for the MCP chart tools: `{ last, unit }` is resolved here, in the MCP layer, to
 * the inclusive `{ from, to }` of `YYYY-MM-DD` days the tools already send to the v3 data operations.
 * Neither the v3 contract nor Cube learns a new range shape.
 *
 * The window ends today and counts backwards, both ends included, as the app's date presets do:
 * `{ last: 7, unit: "day" }` is today plus the six days before it, and `{ last: 8, unit: "week" }` is
 * today plus the preceding 7 weeks (56 days). A month window subtracts `last` calendar months from
 * today — clamped to the shorter month's last day — and includes both ends, so `{ last: 3, unit: "month" }`
 * reaches three calendar months back through today.
 *
 * "Today" is the current UTC date: the organization's reporting time zone is read from the database after
 * the v3 call starts, and a second read per tool call only to move this anchor is not worth it. The
 * resolved days are still read in the organization's time zone by the v3 operation, so the only difference
 * from a caller's own `{ from, to }` is which day is "today" around midnight.
 */
export const MAX_RELATIVE_CHART_RANGE_DAYS = 365;

/** Day lengths of the fixed-width units; a month is calendar arithmetic instead. */
const UNIT_DAYS = { day: 1, week: 7 } as const;

export const ZMcpRelativeChartDateRange = z
  .object({
    last: z
      .number()
      .int()
      .min(1)
      .max(MAX_RELATIVE_CHART_RANGE_DAYS)
      .describe(
        "Day and week windows count inclusively from today; a month window subtracts this many calendar months from today. At most 365 days, 52 weeks or 11 months: a window longer than 365 days is refused."
      ),
    unit: z.enum(["day", "week", "month"]).describe("The unit last counts: day, week or month."),
  })
  .strict()
  .describe(
    `A trailing window ending today, both ends included: { last: 8, unit: "week" } is today plus the preceding 7 weeks (56 days), and { last: 3, unit: "month" } is three calendar months back through today, the day clamped in shorter months. Covers at most ${MAX_RELATIVE_CHART_RANGE_DAYS} days. Anchored to the current UTC date, then read as calendar days in the organization's time zone; use { from, to } for a longer or exact window. A { last: 12, unit: "month" } window is 366 inclusive days (e.g. 2025-11-24 through 2026-11-24) and 367 when it spans a leap day, so it is always refused: a full year needs { from, to } or 11 months.`
  )
  .superRefine((range, ctx) => {
    const days = relativeChartRangeDays(range);
    if (days > MAX_RELATIVE_CHART_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["last"],
        message: `A ${range.last}-${range.unit} window covers ${days} days; a relative range may cover at most ${MAX_RELATIVE_CHART_RANGE_DAYS}. Use { from, to } for a longer range.`,
      });
    }
  });
export type TMcpRelativeChartDateRange = z.infer<typeof ZMcpRelativeChartDateRange>;

/** Today's calendar day as a date-only value, read in UTC so the anchor does not depend on the server's zone. */
const todayInUtc = (now: Date): Date => getCalendarDayInTimeZone(now, "UTC");

/** The first day a relative window covers, as a date-only value. */
const startOfRelativeRange = (range: TMcpRelativeChartDateRange, today: Date): Date =>
  range.unit === "month"
    ? subMonths(today, range.last)
    : addDays(today, -(range.last * UNIT_DAYS[range.unit] - 1));

/** The number of calendar days a relative window covers, both ends included. */
export const relativeChartRangeDays = (range: TMcpRelativeChartDateRange, now: Date = new Date()): number => {
  const today = todayInUtc(now);
  return differenceInCalendarDays(today, startOfRelativeRange(range, today)) + 1;
};

/** The inclusive `YYYY-MM-DD` days a relative window covers, anchored to the current UTC date. */
export const resolveRelativeChartDateRange = (
  range: TMcpRelativeChartDateRange,
  now: Date = new Date()
): { from: string; to: string } => {
  const today = todayInUtc(now);
  return { from: formatLocalDay(startOfRelativeRange(range, today)), to: formatLocalDay(today) };
};

/** A date range as the three chart tools accept it: a preset string, an explicit pair, or a relative window. */
type TMcpChartDateRangeInput = string | { from: string; to: string } | TMcpRelativeChartDateRange | undefined;

/** The v3 data routes' query parameters: `dateRange`, or `from` and `to` together. */
type TMcpChartDateRangeQuery = { dateRange: string } | { from: string; to: string } | Record<string, never>;

export type TResolvedMcpChartDateRange = {
  /** The preview body's `dateRange`: the preset string, or the inclusive days of an explicit or relative range. */
  bodyDateRange: string | { from: string; to: string } | undefined;
  /** The v3 data routes' query parameters for the same range. */
  query: TMcpChartDateRangeQuery;
};

/**
 * What the v3 operations take for a chart tool's `dateRange`: a preset stays the string the caller sent,
 * an explicit `{ from, to }` stays that pair, and `{ last, unit }` becomes the inclusive `{ from, to }` of
 * resolved days. Every call site uses this, so no tool can send the relative object past the MCP layer.
 */
export const resolveMcpChartDateRange = (
  dateRange: TMcpChartDateRangeInput,
  now: Date = new Date()
): TResolvedMcpChartDateRange => {
  if (dateRange === undefined) return { bodyDateRange: undefined, query: {} };
  if (typeof dateRange === "string") return { bodyDateRange: dateRange, query: { dateRange } };
  const days = "last" in dateRange ? resolveRelativeChartDateRange(dateRange, now) : dateRange;
  return {
    bodyDateRange: { from: days.from, to: days.to },
    query: { from: days.from, to: days.to },
  };
};
