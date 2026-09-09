/**
 * Resolve the date range a generation asked for into the two shapes Cube and the chart builder both
 * understand: a named preset, or an explicit `[start, end]` pair of calendar dates.
 *
 * The generator used to take `dateRange` as a bare string, which left the model free to answer
 * "August and September" with whatever range notation it liked — an ISO 8601 interval
 * (`2026-08-01T00:00:00.000Z/2026-09-30T23:59:59.999Z`) being the usual choice. Nothing downstream
 * reads that: `expandPresetDateRanges` only resolves preset *names*, so it reached Cube verbatim and
 * queried the wrong window, and the builder's date select classified any string as a preset and
 * rendered the raw interval as a one-off dropdown entry.
 *
 * The fix is to stop asking for a string. The model now picks a preset or fills in two dates, and
 * this turns that answer into a `dateRange` — dropping it entirely rather than passing on something
 * unusable.
 */

/** Calendar dates only: Cube widens a bare `yyyy-MM-dd` end to the end of that day itself. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type TAIDateRangeInput = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
};

/**
 * Whether `value` is a calendar date that exists. The pattern alone accepts 2026-02-31, which
 * `Date` silently rolls forward to March 3rd — a window nobody asked for.
 */
const isCalendarDate = (value: string): boolean => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const resolveAIDateRange = ({
  preset,
  start,
  end,
}: TAIDateRangeInput): string | [string, string] | undefined => {
  // A preset wins: it is the answer that survives being re-opened tomorrow, where an explicit range
  // that meant "the last 30 days" freezes to the month it was generated in.
  const trimmedPreset = preset?.trim();
  if (trimmedPreset) return trimmedPreset;

  const trimmedStart = start?.trim();
  const trimmedEnd = end?.trim();
  if (!trimmedStart || !trimmedEnd) return undefined;
  if (!isCalendarDate(trimmedStart) || !isCalendarDate(trimmedEnd)) return undefined;

  // Two real dates in the wrong order still name a real window, so read it rather than discard it.
  return trimmedStart <= trimmedEnd ? [trimmedStart, trimmedEnd] : [trimmedEnd, trimmedStart];
};
