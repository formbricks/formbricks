import type { TChartQuery } from "@formbricks/types/analysis";
import { isSubDayDateRangePreset, resolveDateRangePreset } from "@/lib/date-ranges";
import { formatLocalDay } from "@/lib/utils/datetime";

/**
 * Prepares a chart query for Cube in the organization's reporting time zone.
 *
 * Sets the query's `timezone`, so Cube reads date strings and cuts time buckets in that zone, and
 * expands preset names into the explicit inclusive ranges defined in `@/lib/date-ranges` — Cube's
 * native "last N days" / "this month" strings exclude today, and the survey summary filter resolves
 * the same names through the same module, so both surfaces cover the same days for the same viewer.
 */
export const expandPresetDateRanges = (
  query: TChartQuery,
  timeZone: string,
  now: Date = new Date()
): TChartQuery => {
  const timeDimensions = query.timeDimensions?.map((td) => {
    const preset = td.dateRange;
    if (typeof preset !== "string") return td;
    const range = resolveDateRangePreset(preset, timeZone, now);
    if (!range) return td;
    const [start, end] = range;
    // Sub-day presets serialize as UTC ISO 8601 (with the `Z` offset, milliseconds truncated) so the
    // same instant produces the same string regardless of the server's timezone — Cube reads these
    // bare timestamps as UTC. Calendar-day presets stay date-only, keeping their calendar-day meaning
    // in the query's zone (Cube widens a date-only end to 23:59:59.999 itself).
    const serialize = (date: Date): string =>
      isSubDayDateRangePreset(preset) ? `${date.toISOString().slice(0, 19)}Z` : formatLocalDay(date);
    return {
      ...td,
      dateRange: [serialize(start), serialize(end)] as [string, string],
    };
  });

  return { ...query, timezone: timeZone, ...(timeDimensions ? { timeDimensions } : {}) };
};
