import type { TChartQuery } from "@formbricks/types/analysis";
import { DASHBOARD_DATE_PRESETS } from "@/modules/ee/analysis/lib/date-presets";

// The dashboard-level date filter only ever overrides the "Collected at" time dimension, as
// specified by ENG-1553. Other time dimensions (e.g. createdAt) are left untouched.
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
const isRealIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// A valid custom range needs two real dates in chronological order. ISO date strings compare
// lexicographically the same as chronologically, so a plain string comparison is enough.
const isValidCustomRange = (from: string, to: string): boolean =>
  isRealIsoDate(from) && isRealIsoDate(to) && from <= to;

export type TDashboardDateFilter =
  | { type: "preset"; value: string }
  | { type: "custom"; range: [string, string] }
  | { type: "all-time" };

/**
 * Apply the dashboard-level date filter to a single chart query by overriding its "Collected at"
 * time dimension. Returns the query unchanged when no filter is active.
 *
 * - all-time: strip the dateRange from the collectedAt time dimension (no-op if none exists).
 * - preset/custom: override the collectedAt dateRange, or append a filter-only time dimension
 *   (no granularity) when the chart has none.
 *
 * Pure and immutable — the input query is never mutated.
 */
export const applyDashboardDateFilter = (
  query: TChartQuery,
  filter: TDashboardDateFilter | null
): TChartQuery => {
  if (!filter) return query;

  const timeDimensions = query.timeDimensions ?? [];
  const index = timeDimensions.findIndex((td) => td.dimension === COLLECTED_AT_DIMENSION);

  if (filter.type === "all-time") {
    if (index === -1 || timeDimensions[index].dateRange === undefined) return query;
    const next = [...timeDimensions];
    const { dateRange: _dateRange, ...rest } = next[index];
    next[index] = rest;
    return { ...query, timeDimensions: next };
  }

  const dateRange = filter.type === "preset" ? filter.value : filter.range;

  if (index === -1) {
    return {
      ...query,
      timeDimensions: [...timeDimensions, { dimension: COLLECTED_AT_DIMENSION, dateRange }],
    };
  }

  const next = [...timeDimensions];
  next[index] = { ...next[index], dateRange };
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
    if (from && to && isValidCustomRange(from, to)) {
      return { type: "custom", range: [from, to] };
    }
    return null;
  }

  if ((DASHBOARD_DATE_PRESETS as readonly string[]).includes(value)) {
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
    (DASHBOARD_DATE_PRESETS as readonly string[]).includes(filter.value)
  ) {
    return { type: "preset", value: filter.value };
  }

  if (filter.type === "custom" && Array.isArray(filter.range) && filter.range.length === 2) {
    const [from, to] = filter.range;
    if (typeof from === "string" && typeof to === "string" && isValidCustomRange(from, to)) {
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
 * Persist (or clear, when null) the dashboard date filter in a cookie. Client-only and defensive:
 * no-ops during SSR. `SameSite=Lax` keeps the cookie on top-level navigations (shared links) without
 * exposing it cross-site.
 */
export const writeStoredDateFilter = (dashboardId: string, filter: TDashboardDateFilter | null): void => {
  if (typeof document === "undefined") return;
  const name = getDateFilterCookieName(dashboardId);
  if (filter) {
    const value = encodeURIComponent(JSON.stringify(filter));
    document.cookie = `${name}=${value}; path=/; max-age=${DATE_FILTER_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } else {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
};
