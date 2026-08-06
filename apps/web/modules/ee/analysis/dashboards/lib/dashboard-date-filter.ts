import type { TChartQuery } from "@formbricks/types/analysis";
import { DASHBOARD_DATE_PRESETS } from "@/modules/ee/analysis/lib/date-presets";

// The dashboard-level date filter only ever overrides the "Collected at" time dimension, as
// specified by ENG-1553. Other time dimensions (e.g. createdAt) are left untouched.
export const COLLECTED_AT_DIMENSION = "FeedbackRecords.collectedAt";

// URL search-param keys + reserved values for the dashboard date filter.
export const DATE_FILTER_PARAM = "dateRange";
export const DATE_FILTER_FROM_PARAM = "from";
export const DATE_FILTER_TO_PARAM = "to";
export const ALL_TIME_VALUE = "all time";
export const CUSTOM_VALUE = "custom";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    if (from && to && ISO_DATE.test(from) && ISO_DATE.test(to)) {
      return { type: "custom", range: [from, to] };
    }
    return null;
  }

  if ((DASHBOARD_DATE_PRESETS as readonly string[]).includes(value)) {
    return { type: "preset", value };
  }

  return null;
};
