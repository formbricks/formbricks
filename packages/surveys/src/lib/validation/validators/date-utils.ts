import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TRelativeDateBound, TValidationRule } from "@formbricks/types/surveys/validation-rules";

/**
 * Format a Date as YYYY-MM-DD using its local calendar fields.
 * Date rule values are stored and compared as YYYY-MM-DD strings, never as instants.
 */
export const toISODateString = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Strip the time part so all arithmetic happens on whole local days. */
const atMidnight = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * Add a signed number of calendar days. Negative moves into the past.
 */
export const addCalendarDays = (date: Date, days: number): Date => {
  const result = atMidnight(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Add a signed number of working days (Mon-Fri). Negative moves into the past.
 *
 * Only weekdays are counted, so weekends are stepped over rather than consumed. An amount of 0
 * returns the reference date unchanged even when it falls on a weekend - the toggle governs how
 * the offset is counted, not which days a respondent may pick.
 */
export const addWorkingDays = (date: Date, days: number): Date => {
  const result = atMidnight(date);
  if (days === 0) return result;

  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);

  while (remaining > 0) {
    result.setDate(result.getDate() + step);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }

  return result;
};

/**
 * Resolve a relative bound against a reference date, returning YYYY-MM-DD.
 */
export const resolveRelativeDate = (bound: TRelativeDateBound, referenceDate: Date): string => {
  const offset = (bound.direction === "before" ? -1 : 1) * bound.amount;
  const resolved =
    bound.unit === "workingDays"
      ? addWorkingDays(referenceDate, offset)
      : addCalendarDays(referenceDate, offset);

  return toISODateString(resolved);
};

/** Shift a YYYY-MM-DD string by whole calendar days. */
export const shiftISODate = (isoDate: string, days: number): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return toISODateString(new Date(year, month - 1, day + days));
};

/**
 * The same evaluator runs in the respondent's browser and on the server. A respondent at UTC+13
 * can submit their local "today" while the server clock still reads yesterday (or the reverse at
 * UTC-11), which would reject a date the picker itself offered. Proper timezone handling is out of
 * scope for this feature, so the server widens every relative window by one calendar day on each
 * side and the client stays strict.
 *
 * The widening follows the role of the bound, not its direction: a lower bound always moves
 * earlier and an upper bound always moves later, so a window that sits entirely in the future
 * (between +2 and +5 days) widens rather than closing in on itself.
 */
export const applyTimezoneGrace = (isoDate: string, role: "lower" | "upper"): string => {
  if (typeof window !== "undefined") return isoDate;
  return shiftISODate(isoDate, role === "lower" ? -1 : 1);
};

/** Type guards for the fixed vs relative param shapes of the four date rules. */
export const hasRelativeBound = (params: unknown): params is { relative: TRelativeDateBound } =>
  typeof params === "object" && params !== null && "relative" in params;

export const hasRelativeRange = (
  params: unknown
): params is { relativeStart: TRelativeDateBound; relativeEnd: TRelativeDateBound } =>
  typeof params === "object" && params !== null && "relativeStart" in params && "relativeEnd" in params;

const isValidISODate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export interface TDateBounds {
  minDate?: string;
  maxDate?: string;
}

const narrowMin = (bounds: TDateBounds, candidate: string): void => {
  if (!bounds.minDate || candidate > bounds.minDate) bounds.minDate = candidate;
};

const narrowMax = (bounds: TDateBounds, candidate: string): void => {
  if (!bounds.maxDate || candidate < bounds.maxDate) bounds.maxDate = candidate;
};

/**
 * Derive the selectable date window from an element's validation rules so the picker can grey out
 * dates the evaluator would reject on submit.
 *
 * The two modes differ on purpose and this must mirror the validators exactly: fixed bounds are
 * exclusive (isLaterThan 2026-03-01 first allows 2026-03-02), relative bounds are inclusive.
 *
 * Rules that do not describe a single interval are skipped: isNotBetween punches a hole rather
 * than bounding the range, and "or" logic means any one rule may be satisfied, so no date can be
 * ruled out up front. Both still fail on submit as before.
 */
/**
 * Resolve one end of a single-bound rule. Relative bounds are inclusive, so they land on the
 * resolved day; fixed bounds are exclusive, so they shift one day inwards.
 */
const resolveSingleBound = (
  params: Record<string, unknown>,
  referenceDate: Date,
  fixedShift: 1 | -1
): string | undefined => {
  if (hasRelativeBound(params)) return resolveRelativeDate(params.relative, referenceDate);
  return isValidISODate(params.date) ? shiftISODate(params.date, fixedShift) : undefined;
};

/** Resolve both ends of a range rule, under the same inclusive/exclusive split. */
const resolveRangeBounds = (params: Record<string, unknown>, referenceDate: Date): TDateBounds => {
  if (hasRelativeRange(params)) {
    return {
      minDate: resolveRelativeDate(params.relativeStart, referenceDate),
      maxDate: resolveRelativeDate(params.relativeEnd, referenceDate),
    };
  }

  if (isValidISODate(params.startDate) && isValidISODate(params.endDate)) {
    return {
      minDate: shiftISODate(params.startDate, 1),
      maxDate: shiftISODate(params.endDate, -1),
    };
  }

  return {};
};

/** The window a single rule implies, or an empty object when it implies none. */
const boundsForRule = (rule: TValidationRule, referenceDate: Date): TDateBounds => {
  const params = rule.params as Record<string, unknown>;

  switch (rule.type) {
    case "isLaterThan":
      return { minDate: resolveSingleBound(params, referenceDate, 1) };
    case "isEarlierThan":
      return { maxDate: resolveSingleBound(params, referenceDate, -1) };
    case "isBetween":
      return resolveRangeBounds(params, referenceDate);
    default:
      // isNotBetween punches a hole rather than bounding the range, so it contributes nothing.
      return {};
  }
};

/**
 * Derive the selectable date window from an element's validation rules so the picker can grey out
 * dates the evaluator would reject on submit.
 *
 * The two modes differ on purpose and this must mirror the validators exactly: fixed bounds are
 * exclusive (isLaterThan 2026-03-01 first allows 2026-03-02), relative bounds are inclusive.
 *
 * Under "or" logic any single rule may be satisfied, so no date can be ruled out up front and the
 * picker stays open; those rules still fail on submit as before.
 */
export const getDateBoundsFromRules = (element: TSurveyElement, referenceDate: Date): TDateBounds => {
  const validation = (
    element as TSurveyElement & { validation?: { rules?: TValidationRule[]; logic?: "and" | "or" } }
  ).validation;

  const rules = validation?.rules ?? [];
  if (rules.length === 0 || validation?.logic === "or") return {};

  const bounds: TDateBounds = {};

  for (const rule of rules) {
    const { minDate, maxDate } = boundsForRule(rule, referenceDate);
    if (minDate) narrowMin(bounds, minDate);
    if (maxDate) narrowMax(bounds, maxDate);
  }

  return bounds;
};
