import { addDays, formatDate, startOfDay, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import type { TChartQuery } from "@formbricks/types/analysis";

// Cube's native "last N days" / "this month" / etc. strings exclude today; we expand them
// to explicit inclusive ranges so charts behave like every other analytics tool (GA, Mixpanel,
// PostHog, ...) and include the current partial day.
const PRESET_RESOLVERS: Record<string, (now: Date) => [Date, Date]> = {
  today: (now) => [startOfDay(now), startOfDay(now)],
  yesterday: (now) => [addDays(startOfDay(now), -1), addDays(startOfDay(now), -1)],
  "last 7 days": (now) => [addDays(startOfDay(now), -6), startOfDay(now)],
  "last 30 days": (now) => [addDays(startOfDay(now), -29), startOfDay(now)],
  "this month": (now) => [startOfMonth(now), startOfDay(now)],
  "last month": (now) => {
    const firstOfThisMonth = startOfMonth(now);
    const lastOfLastMonth = addDays(firstOfThisMonth, -1);
    return [startOfMonth(lastOfLastMonth), lastOfLastMonth];
  },
  "this quarter": (now) => [startOfQuarter(now), startOfDay(now)],
  "this year": (now) => [startOfYear(now), startOfDay(now)],
};

export const expandPresetDateRanges = (query: TChartQuery, now: Date = new Date()): TChartQuery => {
  if (!query.timeDimensions?.length) return query;

  const expanded = query.timeDimensions.map((td) => {
    if (typeof td.dateRange !== "string") return td;
    const resolver = PRESET_RESOLVERS[td.dateRange.toLowerCase().trim()];
    if (!resolver) return td;
    const [start, end] = resolver(now);
    return {
      ...td,
      dateRange: [formatDate(start, "yyyy-MM-dd"), formatDate(end, "yyyy-MM-dd")] as [string, string],
    };
  });

  return { ...query, timeDimensions: expanded };
};
