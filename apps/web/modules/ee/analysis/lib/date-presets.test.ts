import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  DATE_RANGE_PRESETS,
  getCalendarDayInTimeZone,
  isSubDayDateRangePreset,
  resolveDateRangePresetBounds,
} from "@/lib/date-ranges";
import { formatLocalDay } from "@/lib/utils/datetime";
import { expandPresetDateRanges } from "./date-presets";

const queryWithDateRange = (dateRange: string | [string, string]): TChartQuery => ({
  measures: ["FeedbackRecords.count"],
  timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange }],
});

// Mid-month, mid-quarter instant that exercises month/quarter/year boundaries cleanly, fixed in UTC so
// the assertions do not depend on the runner's own zone.
const NOW = new Date("2026-05-21T14:30:00Z");
const UTC = "UTC";
const BERLIN = "Europe/Berlin";

const expandedRange = (dateRange: string | [string, string], timeZone = UTC, now = NOW) =>
  expandPresetDateRanges(queryWithDateRange(dateRange), timeZone, now).timeDimensions?.[0].dateRange;

describe("expandPresetDateRanges", () => {
  test("includes today for 'last 7 days'", () => {
    expect(expandedRange("last 7 days")).toEqual(["2026-05-15", "2026-05-21"]);
  });

  test("includes today for 'last 30 days'", () => {
    expect(expandedRange("last 30 days")).toEqual(["2026-04-22", "2026-05-21"]);
  });

  test("expands 'today' to today..today", () => {
    expect(expandedRange("today")).toEqual(["2026-05-21", "2026-05-21"]);
  });

  test("expands 'yesterday' to yesterday..yesterday", () => {
    expect(expandedRange("yesterday")).toEqual(["2026-05-20", "2026-05-20"]);
  });

  test("'this month' runs from the 1st through today", () => {
    expect(expandedRange("this month")).toEqual(["2026-05-01", "2026-05-21"]);
  });

  test("'last month' is the full previous calendar month", () => {
    expect(expandedRange("last month")).toEqual(["2026-04-01", "2026-04-30"]);
  });

  test("'last month' handles year rollover", () => {
    expect(expandedRange("last month", UTC, new Date("2026-01-15T10:00:00Z"))).toEqual([
      "2025-12-01",
      "2025-12-31",
    ]);
  });

  test("'this quarter' starts at the first day of the calendar quarter", () => {
    expect(expandedRange("this quarter")).toEqual(["2026-04-01", "2026-05-21"]);
  });

  test("'this year' starts on Jan 1", () => {
    expect(expandedRange("this year")).toEqual(["2026-01-01", "2026-05-21"]);
  });

  test("'last 24 hours' serializes as UTC timestamps ending now, whatever the zone", () => {
    expect(expandedRange("last 24 hours", UTC)).toEqual(["2026-05-20T14:30:00Z", "2026-05-21T14:30:00Z"]);
    expect(expandedRange("last 24 hours", BERLIN)).toEqual(["2026-05-20T14:30:00Z", "2026-05-21T14:30:00Z"]);
  });

  test("'last quarter' is the full previous calendar quarter", () => {
    expect(expandedRange("last quarter")).toEqual(["2026-01-01", "2026-03-31"]);
  });

  test("'last 6 months' runs from 6 months back through today", () => {
    expect(expandedRange("last 6 months")).toEqual(["2025-11-21", "2026-05-21"]);
  });

  test("'last year' is the full previous calendar year", () => {
    expect(expandedRange("last year")).toEqual(["2025-01-01", "2025-12-31"]);
  });

  test("takes 'today' from the reporting zone, where the day may already have rolled over", () => {
    // 22:30 UTC is still May 21 in UTC but already May 22 in Berlin.
    const lateEvening = new Date("2026-05-21T22:30:00Z");
    expect(expandedRange("today", UTC, lateEvening)).toEqual(["2026-05-21", "2026-05-21"]);
    expect(expandedRange("today", BERLIN, lateEvening)).toEqual(["2026-05-22", "2026-05-22"]);
    expect(expandedRange("last 7 days", BERLIN, lateEvening)).toEqual(["2026-05-16", "2026-05-22"]);
  });

  test("sets the query's time zone so Cube cuts its buckets in the same zone as the dates", () => {
    expect(expandPresetDateRanges(queryWithDateRange("last 7 days"), BERLIN, NOW).timezone).toBe(BERLIN);
  });

  test("sets the time zone even when the query has no time dimension", () => {
    const q: TChartQuery = { measures: ["FeedbackRecords.count"] };
    expect(expandPresetDateRanges(q, BERLIN, NOW)).toEqual({ ...q, timezone: BERLIN });
  });

  test("leaves explicit [start, end] tuple unchanged", () => {
    expect(expandedRange(["2026-01-01", "2026-01-15"])).toEqual(["2026-01-01", "2026-01-15"]);
  });

  test("leaves an unknown preset string unchanged so Cube can interpret it", () => {
    expect(expandedRange("from -3 days to now")).toBe("from -3 days to now");
  });

  test("preserves other timeDimension fields (granularity, dimension)", () => {
    const q: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [
        { dimension: "FeedbackRecords.collectedAt", granularity: "day", dateRange: "last 7 days" },
      ],
    };
    const result = expandPresetDateRanges(q, UTC, NOW);
    expect(result.timeDimensions?.[0]).toMatchObject({
      dimension: "FeedbackRecords.collectedAt",
      granularity: "day",
      dateRange: ["2026-05-15", "2026-05-21"],
    });
  });

  test("does not mutate the input query", () => {
    const q = queryWithDateRange("last 7 days");
    const before = JSON.stringify(q);
    expandPresetDateRanges(q, BERLIN, NOW);
    expect(JSON.stringify(q)).toBe(before);
  });

  // A chart and the survey summary filter set to the same preset must cover the same days in the
  // organization's zone, which only holds while both read their ranges from `@/lib/date-ranges`.
  // Redefine either side and this fails.
  test.each(DATE_RANGE_PRESETS.filter((preset) => !isSubDayDateRangePreset(preset)))(
    "'%s' covers the same days as the summary filter",
    (preset) => {
      const lateEvening = new Date("2026-05-21T22:30:00Z");
      const { from, to } = resolveDateRangePresetBounds(preset, BERLIN, lateEvening);
      expect(expandedRange(preset, BERLIN, lateEvening)).toEqual([
        formatLocalDay(getCalendarDayInTimeZone(from, BERLIN)),
        formatLocalDay(getCalendarDayInTimeZone(to, BERLIN)),
      ]);
    }
  );
});
