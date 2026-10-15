// Pure helpers behind DateTimePicker. Everything works in the editor's own time zone (the
// browser's), which is the product rule for creative schedules; values leave as `Date` instants.

export interface TTimeParts {
  hours: number;
  minutes: number;
}

/** "HH:mm", the value format of `<input type="time">` regardless of the display locale. */
const TIME_INPUT_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** Parses the value of a time input. Returns null for empty or out-of-range input. */
export const parseTimeInput = (value: string): TTimeParts | null => {
  const match = TIME_INPUT_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
};

/** Formats a date's local time as "HH:mm" for a time input. */
export const formatTimeInput = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

/** The calendar day of `day` at the given local time, seconds and milliseconds zeroed. */
export const combineDayAndTime = (day: Date, time: TTimeParts): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hours, time.minutes, 0, 0);

/** Local time parts of a date, or midnight when there is no date yet. */
export const getTimeParts = (date: Date | null): TTimeParts =>
  date ? { hours: date.getHours(), minutes: date.getMinutes() } : { hours: 0, minutes: 0 };

/** The IANA zone the editor works in, named next to the fields ("Times in America/New_York"). */
export const getEditorTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export type TDateTimeRangeError = "end_before_start" | null;

/** An end must be strictly after the start; either bound may be empty ("starts immediately", "no end"). */
export const validateDateTimeRange = (start: Date | null, end: Date | null): TDateTimeRangeError =>
  start && end && end.getTime() <= start.getTime() ? "end_before_start" : null;
