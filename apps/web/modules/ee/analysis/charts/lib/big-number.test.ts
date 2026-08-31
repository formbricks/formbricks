import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  computeBigNumberValue,
  prepareQueryForChartType,
  toSingleValueQuery,
} from "@/modules/ee/analysis/charts/lib/big-number";

describe("toSingleValueQuery", () => {
  test("drops the time granularity but keeps the date range, which is a filter", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.npsScore"],
      timeDimensions: [
        {
          dimension: "FeedbackRecords.collectedAt",
          granularity: "day",
          dateRange: "last 30 days",
        },
      ],
    };

    expect(toSingleValueQuery(query)).toEqual({
      measures: ["FeedbackRecords.npsScore"],
      timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", dateRange: "last 30 days" }],
    });
  });

  test("drops dimensions and order, and keeps filters", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.sourceName"],
      order: [["FeedbackRecords.sourceName", "asc"]],
      filters: [{ member: "FeedbackRecords.fieldType", operator: "equals", values: ["nps"] }],
    };

    expect(toSingleValueQuery(query)).toEqual({
      measures: ["FeedbackRecords.count"],
      filters: [{ member: "FeedbackRecords.fieldType", operator: "equals", values: ["nps"] }],
    });
  });

  test("leaves a query that already returns one row untouched", () => {
    const query: TChartQuery = { measures: ["FeedbackRecords.npsScore"] };
    expect(toSingleValueQuery(query)).toEqual(query);
  });
});

describe("prepareQueryForChartType", () => {
  const grouped: TChartQuery = {
    measures: ["FeedbackRecords.npsScore"],
    timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "day" }],
  };

  test("normalizes a big number", () => {
    expect(prepareQueryForChartType(grouped, "big_number")).toEqual({
      measures: ["FeedbackRecords.npsScore"],
      timeDimensions: [{ dimension: "FeedbackRecords.collectedAt" }],
    });
  });

  test.each(["line", "area", "bar", "pie"] as const)("leaves a %s chart grouped", (chartType) => {
    expect(prepareQueryForChartType(grouped, chartType)).toBe(grouped);
  });
});

describe("computeBigNumberValue", () => {
  test("reads the value off the single row a normalized query returns", () => {
    expect(computeBigNumberValue([{ "FeedbackRecords.npsScore": "51.85" }], "FeedbackRecords.npsScore")).toBe(
      51.85
    );
  });

  test("refuses to fold a ratio spread over several rows", () => {
    // A chart saved before the query was normalized can still arrive grouped. Adding these gave
    // 1350 for a period whose real NPS was 51.85, so the caller shows a no-data glyph instead.
    const rows = [
      { "FeedbackRecords.npsScore": "100.00" },
      { "FeedbackRecords.npsScore": "-100.00" },
      { "FeedbackRecords.npsScore": "100.00" },
    ];
    expect(computeBigNumberValue(rows, "FeedbackRecords.npsScore")).toBeNull();
  });

  test("adds up a count across rows, which is additive", () => {
    const rows = [{ "FeedbackRecords.count": "3" }, { "FeedbackRecords.count": "2" }];
    expect(computeBigNumberValue(rows, "FeedbackRecords.count")).toBe(5);
  });

  test("returns null when the measure had nothing to compute", () => {
    expect(
      computeBigNumberValue([{ "FeedbackRecords.npsScore": null }], "FeedbackRecords.npsScore")
    ).toBeNull();
    expect(computeBigNumberValue([], "FeedbackRecords.npsScore")).toBeNull();
  });

  test("keeps a real zero, which is a score and not a missing value", () => {
    expect(computeBigNumberValue([{ "FeedbackRecords.npsScore": "0.00" }], "FeedbackRecords.npsScore")).toBe(
      0
    );
  });

  test("skips non-numeric cells rather than counting them as zero", () => {
    const rows = [
      { "FeedbackRecords.count": "4" },
      { "FeedbackRecords.count": "n/a" },
      { "FeedbackRecords.count": "" },
    ];
    expect(computeBigNumberValue(rows, "FeedbackRecords.count")).toBe(4);
  });
});
