import type { TSurveySchedulingConfig } from "./config";

const DATE_ONLY_SELECTION_UTC_HOUR = 12;
const LOCAL_CALENDAR_NOON_HOUR = 12;

interface TimeZoneDateParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}

const createLocalCalendarDate = ({
  day,
  month,
  year,
}: Pick<TimeZoneDateParts, "day" | "month" | "year">): Date =>
  new Date(year, month - 1, day, LOCAL_CALENDAR_NOON_HOUR, 0, 0, 0);

// Config-independent helpers. `toDateOnlySelection` stores the picked day as noon UTC and
// `isDateDue` compares absolute instants, so neither depends on the scheduling time zone.
export const toDateOnlySelection = (date: Date): Date =>
  new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), DATE_ONLY_SELECTION_UTC_HOUR, 0, 0, 0)
  );

export const isDateDue = (date: Date | null, now: Date = new Date()): boolean =>
  date !== null && date.getTime() <= now.getTime();

/**
 * Builds the timezone-aware scheduling date helpers for a given configuration. The config is
 * sourced from server-only env vars and passed in explicitly so the same logic can run on the
 * server (reconciliation) and on the client (survey editor) with runtime-configured values.
 */
export const createSurveySchedulingDateUtils = (config: TSurveySchedulingConfig) => {
  const timeZoneFormatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: config.timeZone,
    year: "numeric",
  });

  const timeZoneOffsetFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: config.timeZone,
    timeZoneName: "shortOffset",
  });

  const getTimeZoneDateParts = (date: Date): TimeZoneDateParts => {
    const parts = timeZoneFormatter.formatToParts(date);
    const getPartValue = (type: Intl.DateTimeFormatPartTypes): number => {
      const value = parts.find((part) => part.type === type)?.value;

      if (!value) {
        throw new Error(`Missing ${type} in survey scheduling date formatter output`);
      }

      return Number.parseInt(value, 10);
    };

    return {
      day: getPartValue("day"),
      hour: getPartValue("hour"),
      minute: getPartValue("minute"),
      month: getPartValue("month"),
      year: getPartValue("year"),
    };
  };

  const getTimeZoneOffsetMs = (date: Date): number => {
    const offsetValue = timeZoneOffsetFormatter
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;

    if (!offsetValue || offsetValue === "GMT") {
      return 0;
    }

    const match = /^GMT(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?$/.exec(offsetValue);

    if (!match?.groups) {
      throw new Error(`Unsupported survey scheduling timezone offset: ${offsetValue}`);
    }

    const sign = match.groups.sign === "+" ? 1 : -1;
    const hours = Number.parseInt(match.groups.hours, 10);
    const minutes = Number.parseInt(match.groups.minutes ?? "0", 10);

    return sign * ((hours * 60 + minutes) * 60 * 1000);
  };

  const matchesSurveySchedulingLocalTime = (
    date: Date,
    year: number,
    month: number,
    day: number
  ): boolean => {
    const parts = getTimeZoneDateParts(date);

    return (
      parts.year === year &&
      parts.month === month + 1 &&
      parts.day === day &&
      parts.hour === config.localHour &&
      parts.minute === config.localMinute
    );
  };

  const createSurveySchedulingDateTime = (year: number, month: number, day: number): Date => {
    const utcGuessMs = Date.UTC(year, month, day, config.localHour, config.localMinute, 0, 0);
    let candidate = new Date(utcGuessMs);

    for (let attempt = 0; attempt < 3; attempt++) {
      candidate = new Date(utcGuessMs - getTimeZoneOffsetMs(candidate));

      if (matchesSurveySchedulingLocalTime(candidate, year, month, day)) {
        return candidate;
      }
    }

    return candidate;
  };

  const toCalendarDate = (date: Date): Date => {
    return createLocalCalendarDate(getTimeZoneDateParts(date));
  };

  const getMinimumSurveySchedulingCalendarDate = (now: Date = new Date()): Date => {
    const currentSchedulingDateParts = getTimeZoneDateParts(now);
    const minimumSchedulingDate = createLocalCalendarDate(currentSchedulingDateParts);
    const currentSchedulingRunAt = createSurveySchedulingDateTime(
      currentSchedulingDateParts.year,
      currentSchedulingDateParts.month - 1,
      currentSchedulingDateParts.day
    );

    if (now.getTime() < currentSchedulingRunAt.getTime()) {
      return minimumSchedulingDate;
    }

    const nextSchedulingDate = new Date(minimumSchedulingDate);
    nextSchedulingDate.setDate(nextSchedulingDate.getDate() + 1);
    return nextSchedulingDate;
  };

  const normalizeDateOnlySelectionToSurveySchedulingDateTime = (date: Date | null): Date | null => {
    if (!date) {
      return null;
    }

    const { day, month, year } = getTimeZoneDateParts(date);

    return createSurveySchedulingDateTime(year, month - 1, day);
  };

  return {
    toCalendarDate,
    getMinimumSurveySchedulingCalendarDate,
    normalizeDateOnlySelectionToSurveySchedulingDateTime,
  };
};

export type SurveySchedulingDateUtils = ReturnType<typeof createSurveySchedulingDateUtils>;
