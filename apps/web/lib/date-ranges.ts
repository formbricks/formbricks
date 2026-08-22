import {
  addDays,
  endOfDay,
  endOfQuarter,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subHours,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";

// The one definition of what a relative date range means. Every analytics surface resolves here —
// the survey summary filter, which queries `Response.createdAt` with timestamps, and the chart time
// dimension, which sends date strings to Cube — so "last 7 days" cannot cover one window on the
// Summary tab and a different one in a chart.
//
// Ranges are inclusive on both ends and include the current partial day, the convention every other
// analytics tool follows (GA, Mixpanel, PostHog, ...): "last 7 days" is today plus the six days
// before it, not today plus seven. Cube's native "last N days" strings exclude today, which is why
// chart queries expand these into explicit ranges before they are sent.
const PRESET_RESOLVERS = {
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
} satisfies Record<string, (now: Date) => [Date, Date]>;

export type TDateRangePreset = keyof typeof PRESET_RESOLVERS;

// Sub-day presets carry a time of day; the rest are calendar-day ranges and are widened to whole
// days by the consumers that need real instants.
const SUB_DAY_PRESETS: ReadonlySet<TDateRangePreset> = new Set<TDateRangePreset>(["last 24 hours"]);

const isDateRangePreset = (value: string): value is TDateRangePreset =>
  Object.hasOwn(PRESET_RESOLVERS, value);

export const isSubDayDateRangePreset = (preset: string): boolean => {
  const key = preset.toLowerCase().trim();
  return isDateRangePreset(key) && SUB_DAY_PRESETS.has(key);
};

/**
 * Resolves a preset name to its raw `[start, end]` pair, or `null` for anything that is not a known
 * preset — the shape Cube's query expansion needs, where the incoming string may be a preset, an
 * explicit range, or one of Cube's own expressions.
 */
export const resolveDateRangePreset = (preset: string, now: Date = new Date()): [Date, Date] | null => {
  const key = preset.toLowerCase().trim();
  return isDateRangePreset(key) ? PRESET_RESOLVERS[key](now) : null;
};

/**
 * Resolves a preset to the absolute instants that bound it, for callers that filter on real
 * timestamps rather than date strings. Cube widens a bare `yyyy-MM-dd` end to 23:59:59.999 itself; a
 * Prisma `lte` does not, so day-granular presets are widened to whole days here.
 */
export const resolveDateRangePresetBounds = (
  preset: TDateRangePreset,
  now: Date = new Date()
): { from: Date; to: Date } => {
  const [start, end] = PRESET_RESOLVERS[preset](now);
  return SUB_DAY_PRESETS.has(preset)
    ? { from: start, to: end }
    : { from: startOfDay(start), to: endOfDay(end) };
};

/**
 * Finds the first preset covering exactly the same calendar days as `[from, to]` — how a stored
 * range is mapped back to the label that produced it. Matching is day-granular, and `presets` order
 * decides genuine ties (on the 30th of a 30-day month, "last 30 days" and "this month" span the same
 * days).
 */
export const matchDateRangePreset = (
  from: Date,
  to: Date,
  presets: readonly TDateRangePreset[],
  now: Date = new Date()
): TDateRangePreset | null => {
  const day = (date: Date): string => format(date, "yyyy-MM-dd");
  return (
    presets.find((preset) => {
      const bounds = resolveDateRangePresetBounds(preset, now);
      return day(bounds.from) === day(from) && day(bounds.to) === day(to);
    }) ?? null
  );
};
