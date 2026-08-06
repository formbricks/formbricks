import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  ALL_TIME_VALUE,
  CUSTOM_VALUE,
  DATE_FILTER_FROM_PARAM,
  DATE_FILTER_PARAM,
  DATE_FILTER_TO_PARAM,
  applyDashboardDateFilter,
  parseDashboardDateFilter,
} from "./dashboard-date-filter";

const COLLECTED_AT = "FeedbackRecords.collectedAt";

describe("applyDashboardDateFilter", () => {
  test("returns the query unchanged when no filter is active", () => {
    const query: TChartQuery = { measures: ["FeedbackRecords.count"] };
    expect(applyDashboardDateFilter(query, null)).toBe(query);
  });

  test("preset overrides an existing collectedAt dateRange and preserves granularity", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: COLLECTED_AT, granularity: "day", dateRange: "last 30 days" }],
    };
    const result = applyDashboardDateFilter(query, { type: "preset", value: "last 7 days" });
    expect(result.timeDimensions).toEqual([
      { dimension: COLLECTED_AT, granularity: "day", dateRange: "last 7 days" },
    ]);
  });

  test("preset appends a filter-only time dimension when the chart has no collectedAt", () => {
    const query: TChartQuery = { measures: ["FeedbackRecords.count"] };
    const result = applyDashboardDateFilter(query, { type: "preset", value: "last 7 days" });
    expect(result.timeDimensions).toEqual([{ dimension: COLLECTED_AT, dateRange: "last 7 days" }]);
  });

  test("preset leaves other time dimensions untouched", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: "FeedbackRecords.createdAt", granularity: "week" }],
    };
    const result = applyDashboardDateFilter(query, { type: "preset", value: "last 7 days" });
    expect(result.timeDimensions).toEqual([
      { dimension: "FeedbackRecords.createdAt", granularity: "week" },
      { dimension: COLLECTED_AT, dateRange: "last 7 days" },
    ]);
  });

  test("custom range sets an explicit tuple", () => {
    const query: TChartQuery = { measures: ["FeedbackRecords.count"] };
    const result = applyDashboardDateFilter(query, {
      type: "custom",
      range: ["2026-01-01", "2026-01-31"],
    });
    expect(result.timeDimensions).toEqual([
      { dimension: COLLECTED_AT, dateRange: ["2026-01-01", "2026-01-31"] },
    ]);
  });

  test("all-time strips the dateRange but keeps the collectedAt dimension and granularity", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: COLLECTED_AT, granularity: "day", dateRange: "last 30 days" }],
    };
    const result = applyDashboardDateFilter(query, { type: "all-time" });
    expect(result.timeDimensions).toEqual([{ dimension: COLLECTED_AT, granularity: "day" }]);
  });

  test("all-time is a no-op when the collectedAt dimension has no dateRange", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: COLLECTED_AT, granularity: "day" }],
    };
    expect(applyDashboardDateFilter(query, { type: "all-time" })).toBe(query);
  });

  test("all-time is a no-op when there is no collectedAt time dimension", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: "FeedbackRecords.createdAt", dateRange: "last 7 days" }],
    };
    expect(applyDashboardDateFilter(query, { type: "all-time" })).toBe(query);
  });

  test("does not mutate the input query", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: COLLECTED_AT, dateRange: "last 30 days" }],
    };
    const before = JSON.stringify(query);
    applyDashboardDateFilter(query, { type: "preset", value: "last 7 days" });
    expect(JSON.stringify(query)).toBe(before);
  });
});

describe("parseDashboardDateFilter", () => {
  test("returns null when the param is absent", () => {
    expect(parseDashboardDateFilter({})).toBeNull();
  });

  test("parses the all-time value", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: ALL_TIME_VALUE })).toEqual({
      type: "all-time",
    });
  });

  test("parses a known preset", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: "last 7 days" })).toEqual({
      type: "preset",
      value: "last 7 days",
    });
  });

  test("rejects an unknown preset", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: "since forever" })).toBeNull();
  });

  test("parses a valid custom range", () => {
    expect(
      parseDashboardDateFilter({
        [DATE_FILTER_PARAM]: CUSTOM_VALUE,
        [DATE_FILTER_FROM_PARAM]: "2026-01-01",
        [DATE_FILTER_TO_PARAM]: "2026-01-31",
      })
    ).toEqual({ type: "custom", range: ["2026-01-01", "2026-01-31"] });
  });

  test("rejects a custom range missing bounds", () => {
    expect(
      parseDashboardDateFilter({ [DATE_FILTER_PARAM]: CUSTOM_VALUE, [DATE_FILTER_FROM_PARAM]: "2026-01-01" })
    ).toBeNull();
  });

  test("rejects a custom range with malformed dates", () => {
    expect(
      parseDashboardDateFilter({
        [DATE_FILTER_PARAM]: CUSTOM_VALUE,
        [DATE_FILTER_FROM_PARAM]: "01/01/2026",
        [DATE_FILTER_TO_PARAM]: "2026-01-31",
      })
    ).toBeNull();
  });

  test("handles array-valued params by taking the first entry", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: ["last 7 days", "last 30 days"] })).toEqual({
      type: "preset",
      value: "last 7 days",
    });
  });
});
