const DATE_ONLY_SELECTION_UTC_HOUR = 12;
const FIXED_CET_OFFSET_MS = 60 * 60 * 1000;
const LOCAL_CALENDAR_NOON_HOUR = 12;

const getUtcDateParts = (date: Date) => ({
  day: date.getUTCDate(),
  month: date.getUTCMonth(),
  year: date.getUTCFullYear(),
});

const getFixedCETDateParts = (date: Date) => getUtcDateParts(new Date(date.getTime() + FIXED_CET_OFFSET_MS));

export const toDateOnlySelection = (date: Date): Date =>
  new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), DATE_ONLY_SELECTION_UTC_HOUR, 0, 0, 0)
  );

export const toCalendarDate = (date: Date): Date => {
  const { day, month, year } = getFixedCETDateParts(date);

  return new Date(year, month, day, LOCAL_CALENDAR_NOON_HOUR, 0, 0, 0);
};

export const getCurrentFixedCETCalendarDate = (now: Date = new Date()): Date => {
  const { day, month, year } = getFixedCETDateParts(now);

  return new Date(year, month, day, LOCAL_CALENDAR_NOON_HOUR, 0, 0, 0);
};

export const normalizeDateOnlySelectionToCETMidnight = (date: Date | null): Date | null => {
  if (!date) {
    return null;
  }

  const { day, month, year } = getFixedCETDateParts(date);

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - FIXED_CET_OFFSET_MS);
};

export const isDateDue = (date: Date | null, now: Date = new Date()): boolean =>
  date !== null && date.getTime() <= now.getTime();
