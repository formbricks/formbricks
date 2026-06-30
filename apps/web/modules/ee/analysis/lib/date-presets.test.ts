import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { expandPresetDateRanges } from "./date-presets";

const queryWithDateRange = (dateRange: string | [string, string]): TChartQuery => ({
  measures: ["FeedbackRecords.count"],
  timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange }],
});

// Mid-month, mid-quarter date that exercises month/quarter/year boundaries cleanly.
const NOW = new Date(2026, 4, 21, 14, 30, 0); // May 21, 2026 14:30 local

describe("expandPresetDateRanges", () => {
  test("includes today for 'last 7 days'", () => {
    const result = expandPresetDateRanges(queryWithDateRange("last 7 days"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-05-15", "2026-05-21"]);
  });

  test("includes today for 'last 30 days'", () => {
    const result = expandPresetDateRanges(queryWithDateRange("last 30 days"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-04-22", "2026-05-21"]);
  });

  test("expands 'today' to today..today", () => {
    const result = expandPresetDateRanges(queryWithDateRange("today"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-05-21", "2026-05-21"]);
  });

  test("expands 'yesterday' to yesterday..yesterday", () => {
    const result = expandPresetDateRanges(queryWithDateRange("yesterday"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-05-20", "2026-05-20"]);
  });

  test("'this month' runs from the 1st through today", () => {
    const result = expandPresetDateRanges(queryWithDateRange("this month"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-05-01", "2026-05-21"]);
  });

  test("'last month' is the full previous calendar month", () => {
    const result = expandPresetDateRanges(queryWithDateRange("last month"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-04-01", "2026-04-30"]);
  });

  test("'last month' handles year rollover", () => {
    const janFirst = new Date(2026, 0, 15, 10, 0, 0);
    const result = expandPresetDateRanges(queryWithDateRange("last month"), janFirst);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2025-12-01", "2025-12-31"]);
  });

  test("'this quarter' starts at the first day of the calendar quarter", () => {
    const result = expandPresetDateRanges(queryWithDateRange("this quarter"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-04-01", "2026-05-21"]);
  });

  test("'this year' starts on Jan 1", () => {
    const result = expandPresetDateRanges(queryWithDateRange("this year"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-01-01", "2026-05-21"]);
  });

  test("leaves explicit [start, end] tuple unchanged", () => {
    const result = expandPresetDateRanges(queryWithDateRange(["2026-01-01", "2026-01-15"]), NOW);
    expect(result.timeDimensions?.[0].dateRange).toEqual(["2026-01-01", "2026-01-15"]);
  });

  test("leaves an unknown preset string unchanged so Cube can interpret it", () => {
    const result = expandPresetDateRanges(queryWithDateRange("from -3 days to now"), NOW);
    expect(result.timeDimensions?.[0].dateRange).toBe("from -3 days to now");
  });

  test("returns input unchanged when there are no time dimensions", () => {
    const q: TChartQuery = { measures: ["FeedbackRecords.count"] };
    expect(expandPresetDateRanges(q, NOW)).toEqual(q);
  });

  test("preserves other timeDimension fields (granularity, dimension)", () => {
    const q: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [
        { dimension: "FeedbackRecords.collectedAt", granularity: "day", dateRange: "last 7 days" },
      ],
    };
    const result = expandPresetDateRanges(q, NOW);
    expect(result.timeDimensions?.[0]).toMatchObject({
      dimension: "FeedbackRecords.collectedAt",
      granularity: "day",
      dateRange: ["2026-05-15", "2026-05-21"],
    });
  });

  test("does not mutate the input query", () => {
    const q = queryWithDateRange("last 7 days");
    const before = JSON.stringify(q);
    expandPresetDateRanges(q, NOW);
    expect(JSON.stringify(q)).toBe(before);
  });
});
