import { formatDateTimeForDisplay } from "@/lib/utils/datetime";

// Pure helpers behind DateTimePicker. Everything works in the editor's own time zone (the
// browser's), which is the product rule for creative schedules; values leave as `Date` instants.

export interface TTimeParts {
  hours: number;
  minutes: number;
}

/** The words a locale writes for before and after noon, normalised for matching (see `normalizeTimeText`). */
export interface TDayPeriodMarkers {
  am: string[];
  pm: string[];
}

/**
 * Lower-cased, NFKC-folded (full-width digits, no-break spaces) and stripped of spaces and of the dots
 * inside "a.m." / "a. m.", so "11:59 P.M." and "11:59pm" compare equal. A dot between digits stays: it
 * is a time separator in some locales.
 */
const normalizeTimeText = (value: string): string =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?<=\p{L})\./gu, "")
    .replace(/\s+/g, "");

// "9", "9:30", "9.30", "930", "0930". Minutes always have two digits, so "9:3" is still being typed.
const CLOCK_PATTERN = /^(\d{1,2})(?:[:.]?(\d{2}))?$/;

/**
 * The day-period markers typed entry accepts in `locale`: English ones always (people type "pm" in any
 * language) plus whatever the locale itself writes ("午後", "p. m.", "du.").
 */
export const getDayPeriodMarkers = (locale?: string): TDayPeriodMarkers => {
  const am = new Set(["am", "a"]);
  const pm = new Set(["pm", "p"]);
  try {
    const format = new Intl.DateTimeFormat(locale ?? "en-US", { hour: "numeric", hour12: true });
    const read = (hours: number, into: Set<string>) => {
      const marker = format
        .formatToParts(new Date(2000, 0, 1, hours))
        .find((part) => part.type === "dayPeriod");
      if (marker) into.add(normalizeTimeText(marker.value));
    };
    read(1, am);
    read(13, pm);
  } catch {
    // An unknown locale tag: the English markers still work.
  }
  return { am: [...am], pm: [...pm] };
};

/**
 * Reads a typed time: 24-hour ("23:59", "2359") or 12-hour with a day period before or after it
 * ("11:59 PM", "11:59pm", "午後11:59"). An hour alone is the full hour. Returns null while the text
 * isn't a time yet, so it can be called on every keystroke.
 */
export const parseTimeText = (text: string, markers: TDayPeriodMarkers): TTimeParts | null => {
  let rest = normalizeTimeText(text);
  let period: "am" | "pm" | null = null;

  // Longest marker first, so "pm" is taken whole rather than as "p" plus a stray "m".
  const candidates = [
    ...markers.am.map((marker) => ({ marker, name: "am" as const })),
    ...markers.pm.map((marker) => ({ marker, name: "pm" as const })),
  ].sort((left, right) => right.marker.length - left.marker.length);
  for (const { marker, name } of candidates) {
    if (rest.endsWith(marker)) {
      rest = rest.slice(0, rest.length - marker.length);
    } else if (rest.startsWith(marker)) {
      rest = rest.slice(marker.length);
    } else {
      continue;
    }
    period = name;
    break;
  }

  const match = CLOCK_PATTERN.exec(rest);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes > 59) return null;

  if (period === null) return hours > 23 ? null : { hours, minutes };
  if (hours < 1 || hours > 12) return null;
  return { hours: (hours % 12) + (period === "pm" ? 12 : 0), minutes };
};

/** A date's local time as the app locale writes it ("11:59 PM", "23:59"); what the time field shows. */
export const formatTimeText = (date: Date, locale?: string): string =>
  formatDateTimeForDisplay(date, locale, { hour: "numeric", minute: "2-digit" });

/** The calendar day of `day` at the given local time, seconds and milliseconds zeroed. */
export const combineDayAndTime = (day: Date, time: TTimeParts): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hours, time.minutes, 0, 0);

/** Local time parts of a date, or midnight when there is no date yet. */
export const getTimeParts = (date: Date | null): TTimeParts =>
  date ? { hours: date.getHours(), minutes: date.getMinutes() } : { hours: 0, minutes: 0 };

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The day a typed time lands on when no day was picked yet: today, or the first pickable day when the
 * lower bound is still ahead (an end can't default to a day before its start).
 */
export const resolveDefaultDay = (now: Date, minDate?: Date): Date => {
  const today = startOfDay(now);
  if (!minDate) return today;
  const first = startOfDay(minDate);
  return first.getTime() > today.getTime() ? first : today;
};

/** Whether `day` is a calendar day before `minDate`'s day; the time of day on either is ignored. */
export const isBeforeDay = (day: Date, minDate?: Date): boolean =>
  minDate !== undefined && startOfDay(day).getTime() < startOfDay(minDate).getTime();

/** The IANA zone the editor works in, named next to the fields ("Times in America/New_York"). */
export const getEditorTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export type TDateTimeRangeError = "end_before_start" | null;

/** An end must be strictly after the start; either bound may be empty ("starts immediately", "no end"). */
export const validateDateTimeRange = (start: Date | null, end: Date | null): TDateTimeRangeError =>
  start && end && end.getTime() <= start.getTime() ? "end_before_start" : null;
