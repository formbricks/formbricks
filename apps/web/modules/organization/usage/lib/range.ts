import { z } from "zod";
import {
  getEndOfDayInTimeZone,
  getStartOfDayInTimeZone,
  resolveDateRangePresetBounds,
} from "@/lib/date-ranges";
import { formatLocalDay, parseLocalDay } from "@/lib/utils/datetime";

/**
 * The windows the Usage page offers (ENG-3315): three presets plus a hand-picked range of calendar days.
 * Days are cut in the organization's reporting time zone, never the browser's, so the page agrees with
 * the survey summary and the dashboards for the same period.
 */
export const USAGE_RANGE_PRESETS = ["this_year", "last_30_days", "all_time"] as const;
export type TUsageRangePreset = (typeof USAGE_RANGE_PRESETS)[number];

export const DEFAULT_USAGE_RANGE_PRESET: TUsageRangePreset = "this_year";

const PRESET_TO_DATE_RANGE_PRESET = {
  this_year: "this year",
  last_30_days: "last 30 days",
} as const;

// A `yyyy-MM-dd` that names a real calendar day — `2026-02-30` matches the pattern but not the round trip.
const ZCalendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as yyyy-MM-dd.")
  .refine((value) => formatLocalDay(parseLocalDay(value)) === value, "Not a valid calendar date.");

export const ZUsageRangeQuery = z
  .object({
    preset: z.enum(USAGE_RANGE_PRESETS).optional(),
    from: ZCalendarDay.optional(),
    to: ZCalendarDay.optional(),
  })
  .superRefine((value, ctx) => {
    const hasCustom = value.from !== undefined || value.to !== undefined;
    if (value.preset && hasCustom) {
      ctx.addIssue({
        code: "custom",
        path: ["preset"],
        message: "Pass either a preset or from/to, not both.",
      });
      return;
    }
    if (!value.preset && (value.from === undefined || value.to === undefined)) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "A custom range needs both from and to." });
      return;
    }
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "from must not be after to." });
    }
  });

export type TUsageRangeQuery = z.infer<typeof ZUsageRangeQuery>;

export type TUsageRangeBounds = { from?: Date; to?: Date };

/**
 * Resolves a validated range to the instants that bound it in `timeZone`. `to` is the last millisecond of
 * the final day, so callers filter with `lte`. All-time leaves both ends open.
 */
export const resolveUsageRange = (
  range: TUsageRangeQuery,
  timeZone: string,
  now: Date = new Date()
): TUsageRangeBounds => {
  if (range.preset === "all_time") return {};
  if (range.preset) {
    return resolveDateRangePresetBounds(PRESET_TO_DATE_RANGE_PRESET[range.preset], timeZone, now);
  }
  if (!range.from || !range.to) return {};
  return {
    from: getStartOfDayInTimeZone(parseLocalDay(range.from), timeZone),
    to: getEndOfDayInTimeZone(parseLocalDay(range.to), timeZone),
  };
};
