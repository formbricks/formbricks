import type { TChartQuery } from "@formbricks/types/analysis";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d: Date, days: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

const startOfQuarter = (d: Date): Date => {
  const month = d.getMonth();
  return new Date(d.getFullYear(), month - (month % 3), 1);
};

const startOfYear = (d: Date): Date => new Date(d.getFullYear(), 0, 1);

// Cube's native "last N days" / "this month" / etc. strings exclude today; we expand them
// to explicit inclusive ranges so charts behave like every other analytics tool (GA, Mixpanel,
// PostHog, ...) and include the current partial day.
const PRESET_RESOLVERS: Record<string, (now: Date) => [Date, Date]> = {
  today: (now) => [startOfDay(now), startOfDay(now)],
  yesterday: (now) => {
    const y = addDays(startOfDay(now), -1);
    return [y, y];
  },
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
    return { ...td, dateRange: [formatDate(start), formatDate(end)] as [string, string] };
  });

  return { ...query, timeDimensions: expanded };
};
