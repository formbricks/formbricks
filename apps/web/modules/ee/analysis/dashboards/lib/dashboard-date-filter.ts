import type { TChartQuery, TMemberFilter } from "@formbricks/types/analysis";
import {
  DATE_RANGE_PRESETS,
  getEndOfDayInTimeZone,
  getStartOfDayInTimeZone,
  isSubDayDateRangePreset,
  resolveDateRangePreset,
} from "@/lib/date-ranges";
import { formatLocalDay, parseLocalDay } from "@/lib/utils/datetime";
import { writeDashboardCookie } from "./dashboard-cookies";

// The dashboard-level date filter only ever narrows the "Collected at" time dimension (ADR-0024).
// Other time dimensions (e.g. createdAt) are left untouched.
export const COLLECTED_AT_DIMENSION = "FeedbackRecords.collectedAt";

// URL search-param keys + reserved values for the dashboard date filter. The custom-range keys are
// namespaced so toggling the filter never clears unrelated `from`/`to` params owned by other UI.
export const DATE_FILTER_PARAM = "dateRange";
export const DATE_FILTER_FROM_PARAM = "dateRangeFrom";
export const DATE_FILTER_TO_PARAM = "dateRangeTo";
export const ALL_TIME_VALUE = "all time";
export const CUSTOM_VALUE = "custom";
// Sentinel for the "clear the dashboard-level filter" menu item. Radix Select rejects an
// empty-string item value, so the null/unselected state needs a real value to be selectable.
export const DEFAULT_VALUE = "default";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ISO_DATE only checks the shape, so "2026-02-30" slips through. Reconstruct the date in UTC and
// confirm every component round-trips to reject impossible calendar dates.
export const isRealIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// A valid custom range needs two real dates in chronological order. ISO date strings compare
// lexicographically the same as chronologically, so a plain string comparison is enough. Shared with the
// chart query validator, so a range the dashboard filter accepts is exactly one the API accepts.
export const isValidCalendarDateRange = (from: string, to: string): boolean =>
  isRealIsoDate(from) && isRealIsoDate(to) && from <= to;

export type TDashboardDateFilter =
  | { type: "preset"; value: string }
  | { type: "custom"; range: [string, string] }
  | { type: "all-time" };

/** What "today" and "now" mean when a relative range is resolved: the organization's reporting zone. */
export type TDateClock = { timeZone: string; now?: Date };

/** A date range on a chart query's time dimension, as Cube takes it. */
type TQueryDateRange = string | [string, string];

/**
 * A date range resolved to its bounds: calendar days (presets, custom pairs) compare as `yyyy-MM-dd`
 * strings; anything with a time of day ("last 24 hours", or an intersection with one) as instants.
 */
type TResolvedRange = { kind: "days"; from: string; to: string } | { kind: "instants"; from: Date; to: Date };

const toCubeInstant = (instant: Date): string => `${instant.toISOString().slice(0, 19)}Z`;

/**
 * The bounds of a date range in the reporting zone, or `null` for a relative range Cube reads itself
 * (one older charts were saved with, such as "last 3 months"), which only Cube can resolve.
 */
const resolveRange = (
  range: TQueryDateRange,
  { timeZone, now = new Date() }: TDateClock
): TResolvedRange | null => {
  if (Array.isArray(range)) {
    if (isRealIsoDate(range[0]) && isRealIsoDate(range[1]))
      return { kind: "days", from: range[0], to: range[1] };
    const from = new Date(range[0]);
    const to = new Date(range[1]);
    return Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) ? null : { kind: "instants", from, to };
  }
  const bounds = resolveDateRangePreset(range, timeZone, now);
  if (!bounds) return null;
  return isSubDayDateRangePreset(range)
    ? { kind: "instants", from: bounds[0], to: bounds[1] }
    : { kind: "days", from: formatLocalDay(bounds[0]), to: formatLocalDay(bounds[1]) };
};

const toInstants = (range: TResolvedRange, timeZone: string): { from: Date; to: Date } =>
  range.kind === "instants"
    ? range
    : {
        from: getStartOfDayInTimeZone(parseLocalDay(range.from), timeZone),
        to: getEndOfDayInTimeZone(parseLocalDay(range.to), timeZone),
      };

/** The range as explicit Cube bounds. */
const toCubeBounds = (range: TResolvedRange): [string, string] =>
  range.kind === "days" ? [range.from, range.to] : [toCubeInstant(range.from), toCubeInstant(range.to)];

/** Where two ranges overlap, or `null` when they do not. */
const intersectRanges = (a: TResolvedRange, b: TResolvedRange, timeZone: string): TResolvedRange | null => {
  if (a.kind === "days" && b.kind === "days") {
    const from = a.from > b.from ? a.from : b.from;
    const to = a.to < b.to ? a.to : b.to;
    return from <= to ? { kind: "days", from, to } : null;
  }
  const x = toInstants(a, timeZone);
  const y = toInstants(b, timeZone);
  const from = x.from > y.from ? x.from : y.from;
  const to = x.to < y.to ? x.to : y.to;
  return from <= to ? { kind: "instants", from, to } : null;
};

/**
 * A filter rule keeping only records collected in `range`, with its bounds written out so it means the
 * same days as a time dimension's range: Cube's own relative strings exclude today (`@/lib/date-ranges`).
 * A relative range only Cube can resolve is passed as it is.
 */
export const toDateRangeRule = (
  dimension: string,
  range: TQueryDateRange,
  clock: TDateClock
): TMemberFilter => {
  const resolved = resolveRange(range, clock);
  const values = resolved ? toCubeBounds(resolved) : Array.isArray(range) ? range : [range];
  return { member: dimension, operator: "inDateRange", values };
};

/**
 * Narrow a chart query to the dashboard's date range (ADR-0024): the requested range is ANDed with the one
 * saved on the chart's "Collected at" time dimension, never replacing it. Other time dimensions are left
 * untouched.
 *
 * - no filter, or all-time: the saved range stands.
 * - a chart without a saved range on collectedAt takes the requested one, appending a filter-only time
 *   dimension (no granularity) when it has none.
 * - otherwise the time dimension gets the overlap of the two, written out as explicit bounds; ranges that
 *   do not overlap answer `null`, "no data", which the caller shows as an empty chart without asking Cube.
 * - a relative range older charts were saved with stays on the time dimension, and the requested range is
 *   added as a filter rule, so Cube ANDs the two.
 *
 * Pure and immutable — the input query is never mutated. `clock` resolves relative ranges in the
 * organization's reporting time zone, as Cube reads them.
 */
export const applyDashboardDateFilter = (
  query: TChartQuery,
  filter: TDashboardDateFilter | null,
  clock: TDateClock
): TChartQuery | null => {
  if (!filter || filter.type === "all-time") return query;

  const requested: TQueryDateRange = filter.type === "preset" ? filter.value : filter.range;
  const timeDimensions = query.timeDimensions ?? [];
  const index = timeDimensions.findIndex((td) => td.dimension === COLLECTED_AT_DIMENSION);

  if (index === -1) {
    return {
      ...query,
      timeDimensions: [...timeDimensions, { dimension: COLLECTED_AT_DIMENSION, dateRange: requested }],
    };
  }

  const saved = timeDimensions[index].dateRange;
  const next = [...timeDimensions];
  if (saved === undefined) {
    next[index] = { ...next[index], dateRange: requested };
    return { ...query, timeDimensions: next };
  }

  const requestedBounds = resolveRange(requested, clock);
  const savedBounds = resolveRange(saved, clock);
  if (!requestedBounds || !savedBounds) {
    return {
      ...query,
      filters: [...(query.filters ?? []), toDateRangeRule(COLLECTED_AT_DIMENSION, requested, clock)],
    };
  }

  const overlap = intersectRanges(requestedBounds, savedBounds, clock.timeZone);
  if (!overlap) return null;
  next[index] = { ...next[index], dateRange: toCubeBounds(overlap) };
  return { ...query, timeDimensions: next };
};

/**
 * Parse the dashboard date filter from URL search params. Returns null (no override) when absent
 * or invalid, so charts fall back to their own saved date ranges.
 */
export const parseDashboardDateFilter = (
  searchParams: Record<string, string | string[] | undefined>
): TDashboardDateFilter | null => {
  const raw = searchParams[DATE_FILTER_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;

  if (value === ALL_TIME_VALUE) return { type: "all-time" };

  if (value === CUSTOM_VALUE) {
    const fromRaw = searchParams[DATE_FILTER_FROM_PARAM];
    const toRaw = searchParams[DATE_FILTER_TO_PARAM];
    const from = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw;
    const to = Array.isArray(toRaw) ? toRaw[0] : toRaw;
    if (from && to && isValidCalendarDateRange(from, to)) {
      return { type: "custom", range: [from, to] };
    }
    return null;
  }

  if ((DATE_RANGE_PRESETS as readonly string[]).includes(value)) {
    return { type: "preset", value };
  }

  return null;
};

// Cookie name for the persisted dashboard date filter. A cookie (rather than localStorage) lets the
// server read the stored filter on the first render pass, so a revisit with no URL param renders the
// filtered widgets directly instead of running every widget query unfiltered and then again after a
// client round trip. Scoped per dashboard so a custom range on one dashboard does not leak into
// another; underscores because cookie-name tokens cannot contain colons.
export const getDateFilterCookieName = (dashboardId: string): string =>
  `fb_dashboard_date_filter_${dashboardId}`;

// Persisted filters live for 30 days, refreshed on every change.
const DATE_FILTER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Validate a JSON string read from localStorage back into a TDashboardDateFilter. Returns null for
 * missing, malformed, or stale values (e.g. a preset that no longer exists), so a bad stored value
 * simply falls back to the default instead of throwing.
 */
export const deserializeStoredDateFilter = (raw: string | null): TDashboardDateFilter | null => {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const filter = parsed as Record<string, unknown>;

  if (filter.type === "all-time") return { type: "all-time" };

  if (
    filter.type === "preset" &&
    typeof filter.value === "string" &&
    (DATE_RANGE_PRESETS as readonly string[]).includes(filter.value)
  ) {
    return { type: "preset", value: filter.value };
  }

  if (filter.type === "custom" && Array.isArray(filter.range) && filter.range.length === 2) {
    const [from, to] = filter.range;
    if (typeof from === "string" && typeof to === "string" && isValidCalendarDateRange(from, to)) {
      return { type: "custom", range: [from, to] };
    }
  }

  return null;
};

/**
 * Deserialize a persisted date filter read from the request cookie (server-side). The cookie value
 * is URL-encoded JSON; decode then validate. Returns null for a missing, malformed, or stale value.
 */
export const readStoredDateFilterFromCookie = (
  rawCookieValue: string | undefined
): TDashboardDateFilter | null => {
  if (!rawCookieValue) return null;
  try {
    return deserializeStoredDateFilter(decodeURIComponent(rawCookieValue));
  } catch {
    return null;
  }
};

/**
 * Persist (or clear, when null) the dashboard date filter in a cookie scoped to the dashboard's
 * page. Client-only and defensive: no-ops during SSR. `SameSite=Lax` keeps the cookie on top-level
 * navigations (shared links) without exposing it cross-site.
 */
export const writeStoredDateFilter = (dashboardId: string, filter: TDashboardDateFilter | null): void =>
  writeDashboardCookie(
    getDateFilterCookieName(dashboardId),
    filter ? encodeURIComponent(JSON.stringify(filter)) : null,
    DATE_FILTER_COOKIE_MAX_AGE_SECONDS
  );

/**
 * The dashboard filter as the chart data API takes it, or `null` when the charts keep their own ranges.
 * Both read a range the same way: it narrows the chart's range on collectedAt.
 */
export const toChartDateRange = (
  filter: TDashboardDateFilter | null
): string | { from: string; to: string } | null => {
  if (!filter) return null;
  if (filter.type === "all-time") return "all-time";
  if (filter.type === "preset") return filter.value;
  return { from: filter.range[0], to: filter.range[1] };
};
