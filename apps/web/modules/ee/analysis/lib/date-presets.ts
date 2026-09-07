import { formatDate } from "date-fns";
import type { TChartQuery } from "@formbricks/types/analysis";
import { isSubDayDateRangePreset, resolveDateRangePreset } from "@/lib/date-ranges";

// Cube's native "last N days" / "this month" / etc. strings exclude today; we expand them to the
// explicit inclusive ranges defined in `@/lib/date-ranges` — shared with the survey summary filter so
// both surfaces mean the same window — which include the current partial day the way every other
// analytics tool does (GA, Mixpanel, PostHog, ...).
export const expandPresetDateRanges = (query: TChartQuery, now: Date = new Date()): TChartQuery => {
  if (!query.timeDimensions?.length) return query;

  const expanded = query.timeDimensions.map((td) => {
    const preset = td.dateRange;
    if (typeof preset !== "string") return td;
    const range = resolveDateRangePreset(preset, now);
    if (!range) return td;
    const [start, end] = range;
    // Sub-day presets serialize as UTC ISO 8601 (with the `Z` offset, milliseconds truncated) so the
    // same instant produces the same string regardless of the server's timezone — Cube reads these
    // bare timestamps as UTC. Day-granular presets stay date-only, keeping their calendar-day meaning
    // (Cube widens a date-only end to 23:59:59.999 itself).
    const serialize = (date: Date): string =>
      isSubDayDateRangePreset(preset)
        ? `${date.toISOString().slice(0, 19)}Z`
        : formatDate(date, "yyyy-MM-dd");
    return {
      ...td,
      dateRange: [serialize(start), serialize(end)] as [string, string],
    };
  });

  return { ...query, timeDimensions: expanded };
};

// Ordered preset list for the dashboard-level date filter. "all time" and "custom" are not presets —
// they are handled by the filter UI / override helper — so they live only in the component, not here.
// Values must match the preset names in `@/lib/date-ranges` so they expand consistently.
export const DASHBOARD_DATE_PRESETS = [
  "last 24 hours",
  "last 7 days",
  "last 30 days",
  "this month",
  "last month",
  "this quarter",
  "last quarter",
  "last 6 months",
  "this year",
  "last year",
] as const;
