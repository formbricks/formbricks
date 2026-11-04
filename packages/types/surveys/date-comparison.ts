import { DATE_LITERAL_PATTERN } from "./expression-types";

/**
 * How both logic engines (`packages/surveys/src/lib/logic.ts` and `apps/web/lib/surveyLogic/utils.ts`)
 * order two stored dates for "is before", "is after" and, on a date field, "equals" (ENG-6935).
 *
 * A date field set by `now()` holds a full UTC timestamp, while a condition's fixed value is a day
 * from the date picker. Compared as instants, a field set at 10:12 on 4 Nov would be "after 4 Nov"
 * and never "equal" to it. So, like `daysBetween()` (P4), a calendar date against anything compares
 * UTC calendar days; two timestamps compare instants.
 *
 * Returns -1, 0 or 1, or `undefined` when either side is not an ISO date (`2026-11-04` or a full
 * ISO timestamp), so the engine keeps reading other stored forms as it always did.
 */
export const compareDateValues = (left: unknown, right: unknown): -1 | 0 | 1 | undefined => {
  const leftTime = toTime(left);
  const rightTime = toTime(right);
  if (leftTime === undefined || rightTime === undefined) return undefined;

  const byDay = isCalendarDate(left) || isCalendarDate(right);
  const a = byDay ? toUtcDay(leftTime) : leftTime;
  const b = byDay ? toUtcDay(rightTime) : rightTime;
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isCalendarDate = (value: unknown): boolean => typeof value === "string" && CALENDAR_DATE.test(value);

const toTime = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !DATE_LITERAL_PATTERN.test(value)) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  // `Date` rolls an impossible day over (2026-02-30 is 2 March); a stored date names a real day.
  if (new Date(time).toISOString().slice(0, 10) !== value.slice(0, 10) && isCalendarDate(value)) {
    return undefined;
  }
  return time;
};

const toUtcDay = (time: number): number => Math.floor(time / MS_PER_DAY);
