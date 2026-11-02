import {
  getEndOfDayInTimeZone,
  getStartOfDayInTimeZone,
  resolveCalendarDayRangeBounds,
  resolveDateRangePresetBounds,
} from "@/lib/date-ranges";
import type { TTableFilter } from "./types";
import { datePresetFromSlug } from "./url-codec";

/** `yyyy-MM-dd` → the local-midnight Date the date-range helpers read as a calendar day. */
export const parseCalendarDay = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** A local calendar day → `yyyy-MM-dd`, the form a date filter keeps in the URL. */
export const formatCalendarDay = (day: Date): string => {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
};

/**
 * Resolves a date filter to the absolute instants a backend filters on, in the organization's
 * reporting time zone — never the browser's (ADR 0015). The URL keeps the preset by name, so a shared
 * link means "the last 7 days" on the day it is opened; this runs just before each request.
 *
 * Returns null for a filter that is not a date quick filter or rule.
 */
export const resolveDateFilterBounds = (
  filter: TTableFilter,
  timeZone: string,
  now: Date = new Date()
): { from?: Date; to?: Date } | null => {
  switch (filter.operator) {
    case "preset": {
      const preset = datePresetFromSlug(filter.values[0] ?? "");
      return preset ? resolveDateRangePresetBounds(preset, timeZone, now) : null;
    }
    case "between": {
      const { from, to } = resolveCalendarDayRangeBounds(
        { from: parseCalendarDay(filter.values[0]), to: parseCalendarDay(filter.values[1]) },
        timeZone
      );
      return { from, to };
    }
    // "Before Oct 5" excludes Oct 5; "after Oct 5" excludes it too.
    case "isBefore":
      return {
        to: new Date(getStartOfDayInTimeZone(parseCalendarDay(filter.values[0]), timeZone).getTime() - 1),
      };
    case "isAfter":
      return {
        from: new Date(getEndOfDayInTimeZone(parseCalendarDay(filter.values[0]), timeZone).getTime() + 1),
      };
    default:
      return null;
  }
};
