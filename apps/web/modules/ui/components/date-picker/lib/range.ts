/**
 * Selection transitions for a two-click date range.
 *
 * `react-day-picker`'s own `mode="range"` handles the two clicks but has no notion of a bound being
 * "the one you are about to pick", and it previews nothing while the pointer moves. Both matter here:
 * the range feeds response/chart filters, so the two bounds are not interchangeable calendar days but a
 * half-open interval that has to cover whole local days — `from` at 00:00:00.000 and `to` at
 * 23:59:59.999 — or a response recorded at 4pm on the last day of the range drops out of it.
 *
 * The transitions live here rather than in the component so they can be tested without a browser.
 */

export interface TDateRangeValue {
  from: Date | undefined;
  to?: Date;
}

/** Which bound the next click sets. */
export type TDateRangeBound = "from" | "to";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const startOfLocalDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const endOfLocalDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

export interface TRangeClickResult {
  range: TDateRangeValue;
  /** Which bound the *following* click should set. */
  nextBound: TDateRangeBound;
  /** True once both bounds are set and the caller can emit / close the calendar. */
  isComplete: boolean;
}

/**
 * Applies a day click to the range.
 *
 * Picking a bound that would invert the range moves the *other* bound to the adjacent day instead of
 * rejecting the click or silently swapping the two. Swapping reads as the calendar ignoring where you
 * clicked; a one-day range at the day you actually clicked keeps that click meaningful, and the next
 * click widens it.
 */
export const applyRangeClick = (
  range: TDateRangeValue,
  bound: TDateRangeBound,
  date: Date
): TRangeClickResult => {
  if (bound === "from") {
    const from = startOfLocalDay(date);

    // `to` unset (nothing to invert) or still after the new `from`: keep it.
    const isInverted = range.to !== undefined && from > range.to;
    const to = isInverted ? endOfLocalDay(new Date(from.getTime() + DAY_IN_MS)) : range.to;

    return { range: { from, to }, nextBound: "to", isComplete: false };
  }

  const to = endOfLocalDay(date);
  const isInverted = range.from !== undefined && to < range.from;
  const from = isInverted ? startOfLocalDay(new Date(to.getTime() - DAY_IN_MS)) : range.from;

  return { range: { from, to }, nextBound: "from", isComplete: from !== undefined };
};

/**
 * The range to paint while the pointer is over `date`, or `null` when hovering there would invert the
 * range — in which case the committed range keeps being shown rather than a misleading preview.
 */
export const applyRangeHover = (
  range: TDateRangeValue,
  bound: TDateRangeBound,
  date: Date
): TDateRangeValue | null => {
  if (bound === "from") {
    const from = startOfLocalDay(date);
    if (range.to !== undefined && from > range.to) return null;
    return { from, to: range.to };
  }

  const to = endOfLocalDay(date);
  if (range.from !== undefined && to < range.from) return null;
  return { from: range.from, to };
};
