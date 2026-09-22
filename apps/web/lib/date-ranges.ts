import {
  addDays,
  endOfQuarter,
  endOfYear,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subHours,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import { formatLocalDay } from "@/lib/utils/datetime";

// The one definition of what a relative date range means. Every analytics surface resolves here —
// the survey summary filter, which queries `Response.createdAt` with timestamps, and the chart time
// dimension, which sends date strings to Cube — so "last 7 days" cannot cover one window on the
// Summary tab and a different one in a chart.
//
// Ranges are inclusive on both ends and include the current partial day, the convention every other
// analytics tool follows (GA, Mixpanel, PostHog, ...): "last 7 days" is today plus the six days
// before it, not today plus seven. Cube's native "last N days" strings exclude today, which is why
// chart queries expand these into explicit ranges before they are sent.
//
// Calendar days are cut in one time zone for everyone in an organization — its display time zone,
// UTC when unset (`getReportingTimeZone`) — never in the viewer's browser zone. Two colleagues on
// different continents therefore see one number for "last 7 days", and the Summary tab agrees with a
// chart over the same field whether the viewer sits in Berlin or the server in UTC.

/** Every preset, in the order the date filters offer them. */
export const DATE_RANGE_PRESETS = [
  "today",
  "yesterday",
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

export type TDateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

type TSubDayDateRangePreset = "last 24 hours";
type TCalendarDateRangePreset = Exclude<TDateRangePreset, TSubDayDateRangePreset>;

// Calendar-day presets are pure calendar arithmetic on `today` — the reporting zone's current
// calendar day — and yield calendar days, so they never touch a clock or an offset.
const CALENDAR_PRESET_RESOLVERS: Record<TCalendarDateRangePreset, (today: Date) => [Date, Date]> = {
  today: (today) => [today, today],
  yesterday: (today) => [addDays(today, -1), addDays(today, -1)],
  "last 7 days": (today) => [addDays(today, -6), today],
  "last 30 days": (today) => [addDays(today, -29), today],
  "this month": (today) => [startOfMonth(today), today],
  "last month": (today) => {
    const lastOfLastMonth = addDays(startOfMonth(today), -1);
    return [startOfMonth(lastOfLastMonth), lastOfLastMonth];
  },
  "this quarter": (today) => [startOfQuarter(today), today],
  "last quarter": (today) => {
    const lastQuarter = subQuarters(today, 1);
    return [startOfQuarter(lastQuarter), startOfDay(endOfQuarter(lastQuarter))];
  },
  "last 6 months": (today) => [subMonths(today, 6), today],
  "this year": (today) => [startOfYear(today), today],
  "last year": (today) => {
    const lastYear = subYears(today, 1);
    return [startOfYear(lastYear), startOfDay(endOfYear(lastYear))];
  },
};

// Sub-day presets carry a time of day and are resolved from the current instant, in no zone at all.
const SUB_DAY_PRESET_RESOLVERS: Record<TSubDayDateRangePreset, (now: Date) => [Date, Date]> = {
  "last 24 hours": (now) => [subHours(now, 24), now],
};

const UTC_TIME_ZONE = "UTC";

/**
 * The IANA zone an organization's calendar days are cut in: its display time zone, UTC when the setting
 * is empty — the same reading the response exports and integrations give it. A name this runtime cannot
 * resolve also reads as UTC, so the value returned here is the zone actually used for every calendar
 * day: hand it to Cube as-is and the two halves of a query can never disagree.
 */
export const getReportingTimeZone = (displayTimeZone: string | null | undefined): string =>
  displayTimeZone && isSupportedTimeZone(displayTimeZone) ? displayTimeZone : UTC_TIME_ZONE;

const normalizePreset = (value: string): string => value.toLowerCase().trim();

const isDateRangePreset = (value: string): value is TDateRangePreset =>
  (DATE_RANGE_PRESETS as readonly string[]).includes(value);

const isSubDayPreset = (preset: TDateRangePreset): preset is TSubDayDateRangePreset =>
  Object.hasOwn(SUB_DAY_PRESET_RESOLVERS, preset);

export const isSubDayDateRangePreset = (preset: string): boolean => {
  const key = normalizePreset(preset);
  return isDateRangePreset(key) && isSubDayPreset(key);
};

// Constructing an Intl formatter is the expensive part of reading a wall clock, and the same zone is
// read many times per render and per chart query, so one formatter per zone is kept for the process —
// including the answer "this runtime does not know that zone", so an unknown name is paid for once.
const wallClockFormatters = new Map<string, Intl.DateTimeFormat | null>();

const createWallClockFormatter = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

const lookupWallClockFormatter = (timeZone: string): Intl.DateTimeFormat | null => {
  const cached = wallClockFormatters.get(timeZone);
  if (cached !== undefined) return cached;

  let formatter: Intl.DateTimeFormat | null;
  try {
    formatter = createWallClockFormatter(timeZone);
  } catch {
    // An unknown zone name makes Intl throw a RangeError. The setting is validated against the
    // runtime's zone list when it is saved, so this only meets a name this runtime does not know.
    formatter = null;
  }
  wallClockFormatters.set(timeZone, formatter);
  return formatter;
};

const isSupportedTimeZone = (timeZone: string): boolean => lookupWallClockFormatter(timeZone) !== null;

// Callers are expected to pass a zone `getReportingTimeZone` resolved, so the UTC fallback only guards a
// direct caller: degrade rather than fail every date filter for the organization.
const getWallClockFormatter = (timeZone: string): Intl.DateTimeFormat =>
  lookupWallClockFormatter(timeZone) ??
  lookupWallClockFormatter(UTC_TIME_ZONE) ??
  createWallClockFormatter(UTC_TIME_ZONE);

type TWallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** What a clock on the wall in `timeZone` shows at `instant`. */
const getWallClock = (instant: Date, timeZone: string): TWallClock => {
  const parts = getWallClockFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

/**
 * The calendar day `instant` falls on in `timeZone`, as a date-only value: a local-midnight `Date` of
 * which only the year, month and day carry meaning — the shape `date-fns` calendar arithmetic, the
 * calendar picker and `formatLocalDay` all speak.
 */
export const getCalendarDayInTimeZone = (instant: Date, timeZone: string): Date => {
  const { year, month, day } = getWallClock(instant, timeZone);
  return new Date(year, month - 1, day);
};

/** How far `timeZone`'s wall clock runs ahead of UTC at `instant`, in milliseconds. */
const getUtcOffsetMs = (instant: Date, timeZone: string): number => {
  const wall = getWallClock(instant, timeZone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  // The wall clock is read to the second, so compare against the instant at the same precision.
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

/** The instant at which the calendar day `day` (a date-only value) begins in `timeZone`. */
export const getStartOfDayInTimeZone = (day: Date, timeZone: string): Date => {
  const wallAsUtc = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  const isOnDay = (instant: number): boolean =>
    isSameDay(getCalendarDayInTimeZone(new Date(instant), timeZone), day);
  // The zone's offset at the guess and at the answer differ when a DST switch lies between them, so
  // resolve twice; the two guesses then bracket the switch.
  const firstGuess = wallAsUtc - getUtcOffsetMs(new Date(wallAsUtc), timeZone);
  const secondGuess = wallAsUtc - getUtcOffsetMs(new Date(firstGuess), timeZone);
  // A switch at midnight itself is the one case a guess can miss the day. Where the clock skips
  // 00:00–00:59 (Santiago and Havana in spring) one guess still reads 23:xx of the day before, so the day
  // begins at the switch: the earliest guess whose wall clock is already on it.
  const guesses = [firstGuess, secondGuess].sort((a, b) => a - b);
  let start = guesses.find(isOnDay) ?? guesses[0];
  // Where the clock is set back at midnight instead (Havana and Amman in autumn) midnight happens twice
  // and a guess can land on the second one, exactly at the switch; the day began at the first.
  const setBackBy = getUtcOffsetMs(new Date(start - 1), timeZone) - getUtcOffsetMs(new Date(start), timeZone);
  if (setBackBy > 0 && isOnDay(start - setBackBy)) start -= setBackBy;
  return new Date(start);
};

/** The last millisecond of the calendar day `day` (a date-only value) in `timeZone`. */
export const getEndOfDayInTimeZone = (day: Date, timeZone: string): Date =>
  new Date(getStartOfDayInTimeZone(addDays(day, 1), timeZone).getTime() - 1);

/**
 * Resolves a preset name to its raw `[start, end]` pair, or `null` for anything that is not a known
 * preset — the shape Cube's query expansion needs, where the incoming string may be a preset, an
 * explicit range, or one of Cube's own expressions. Calendar-day presets yield the zone's calendar
 * days as date-only values; "last 24 hours" yields instants.
 */
export const resolveDateRangePreset = (
  preset: string,
  timeZone: string,
  now: Date = new Date()
): [Date, Date] | null => {
  const key = normalizePreset(preset);
  if (!isDateRangePreset(key)) return null;
  if (isSubDayPreset(key)) return SUB_DAY_PRESET_RESOLVERS[key](now);
  return CALENDAR_PRESET_RESOLVERS[key](getCalendarDayInTimeZone(now, timeZone));
};

/**
 * Resolves a preset to the absolute instants that bound it in `timeZone`, for callers that filter on
 * real timestamps rather than date strings. Cube widens a bare `yyyy-MM-dd` end to 23:59:59.999 in the
 * query's zone itself; a Prisma `lte` does not, so calendar-day presets are widened to whole days here.
 */
export const resolveDateRangePresetBounds = (
  preset: TDateRangePreset,
  timeZone: string,
  now: Date = new Date()
): { from: Date; to: Date } => {
  if (isSubDayPreset(preset)) {
    const [from, to] = SUB_DAY_PRESET_RESOLVERS[preset](now);
    return { from, to };
  }
  const [start, end] = CALENDAR_PRESET_RESOLVERS[preset](getCalendarDayInTimeZone(now, timeZone));
  return { from: getStartOfDayInTimeZone(start, timeZone), to: getEndOfDayInTimeZone(end, timeZone) };
};

/**
 * Widens a hand-picked range of calendar days — date-only values, as a calendar emits them — to the
 * instants bounding those days in `timeZone`. Either end may still be unpicked.
 */
export const resolveCalendarDayRangeBounds = (
  range: { from?: Date; to?: Date },
  timeZone: string
): { from: Date | undefined; to: Date | undefined } => ({
  from: range.from ? getStartOfDayInTimeZone(range.from, timeZone) : undefined,
  to: range.to ? getEndOfDayInTimeZone(range.to, timeZone) : undefined,
});

/**
 * Finds the first calendar-day preset covering exactly the same calendar days as `[from, to]` in
 * `timeZone`, for a range that arrived with no preset attached (a manually picked custom range) —
 * callers that pick a preset from a list should keep that preset alongside the range instead of
 * relying on this to recover it. Once every calendar-period preset ends at "today", several presets
 * become genuinely indistinguishable by their bounds on period-boundary days (e.g. "this month" and
 * "last 7 days" on the 7th of any month, or "last 30 days" and "this month" on the 30th of a 30-day
 * month) — matching is day-granular, and `presets` order picks a winner among those ties, silently
 * mislabeling the other. Sub-day presets never match: a calendar cannot pick a time of day.
 */
export const matchDateRangePreset = (
  from: Date,
  to: Date,
  presets: readonly TDateRangePreset[],
  timeZone: string,
  now: Date = new Date()
): TDateRangePreset | null => {
  const day = (instant: Date): string => formatLocalDay(getCalendarDayInTimeZone(instant, timeZone));
  return (
    presets.find((preset) => {
      if (isSubDayPreset(preset)) return false;
      const bounds = resolveDateRangePresetBounds(preset, timeZone, now);
      return day(bounds.from) === day(from) && day(bounds.to) === day(to);
    }) ?? null
  );
};

/**
 * Resolves the preset that should label `range` for display: the explicit `preset` it was tagged
 * with, if any, otherwise a reverse-match of its bounds against `presets`. A caller that already
 * knows which preset produced a range (e.g. a dropdown selection) should tag the range with it and
 * pass that through here, rather than relying on the bounds alone — those can be genuinely ambiguous
 * (see `matchDateRangePreset`), so the tag is the only reliable source once it exists.
 */
export const resolveDateRangeLabelPreset = (
  range: { from?: Date; to?: Date; preset?: TDateRangePreset },
  presets: readonly TDateRangePreset[],
  timeZone: string,
  now: Date = new Date()
): TDateRangePreset | null => {
  if (range.preset) return range.preset;
  return range.from && range.to ? matchDateRangePreset(range.from, range.to, presets, timeZone, now) : null;
};
