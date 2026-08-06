import {
  addDays,
  endOfQuarter,
  endOfYear,
  formatDate,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subHours,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import type { TChartQuery } from "@formbricks/types/analysis";

// Cube's native "last N days" / "this month" / etc. strings exclude today; we expand them
// to explicit inclusive ranges so charts behave like every other analytics tool (GA, Mixpanel,
// PostHog, ...) and include the current partial day.
const PRESET_RESOLVERS: Record<string, (now: Date) => [Date, Date]> = {
  today: (now) => [startOfDay(now), startOfDay(now)],
  yesterday: (now) => [addDays(startOfDay(now), -1), addDays(startOfDay(now), -1)],
  "last 24 hours": (now) => [subHours(now, 24), now],
  "last 7 days": (now) => [addDays(startOfDay(now), -6), startOfDay(now)],
  "last 30 days": (now) => [addDays(startOfDay(now), -29), startOfDay(now)],
  "this month": (now) => [startOfMonth(now), startOfDay(now)],
  "last month": (now) => {
    const firstOfThisMonth = startOfMonth(now);
    const lastOfLastMonth = addDays(firstOfThisMonth, -1);
    return [startOfMonth(lastOfLastMonth), lastOfLastMonth];
  },
  "this quarter": (now) => [startOfQuarter(now), startOfDay(now)],
  "last quarter": (now) => {
    const lastQuarter = subQuarters(now, 1);
    return [startOfQuarter(lastQuarter), endOfQuarter(lastQuarter)];
  },
  "last 6 months": (now) => [startOfDay(subMonths(now, 6)), startOfDay(now)],
  "this year": (now) => [startOfYear(now), startOfDay(now)],
  "last year": (now) => {
    const lastYear = subYears(now, 1);
    return [startOfYear(lastYear), endOfYear(lastYear)];
  },
};

// Sub-day presets need timestamp precision; day-granular presets stay date-only so charts keep
// their existing calendar-day behavior.
const TIME_PRECISION_PRESETS = new Set(["last 24 hours"]);

export const expandPresetDateRanges = (query: TChartQuery, now: Date = new Date()): TChartQuery => {
  if (!query.timeDimensions?.length) return query;

  const expanded = query.timeDimensions.map((td) => {
    if (typeof td.dateRange !== "string") return td;
    const key = td.dateRange.toLowerCase().trim();
    const resolver = PRESET_RESOLVERS[key];
    if (!resolver) return td;
    const [start, end] = resolver(now);
    const pattern = TIME_PRECISION_PRESETS.has(key) ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd";
    return {
      ...td,
      dateRange: [formatDate(start, pattern), formatDate(end, pattern)] as [string, string],
    };
  });

  return { ...query, timeDimensions: expanded };
};

// Ordered preset list for the dashboard-level date filter. "all time" and "custom" are not
// resolvers — they are handled by the filter UI / override helper — so they live only in the
// component, not here. Values must match PRESET_RESOLVERS keys so they expand consistently.
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
