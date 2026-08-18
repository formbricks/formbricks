import { describe, expect, test, vi } from "vitest";
import { CHART_TYPE_ICONS, getChartTypePrefillQuery, getChartTypes } from "./chart-types";

describe("chart-types", () => {
  test("CHART_TYPE_ICONS has all chart types", () => {
    expect(Object.keys(CHART_TYPE_ICONS)).toEqual(["area", "bar", "line", "pie", "big_number", "sentiment"]);
  });

  test("getChartTypes returns chart types with translated labels", () => {
    const t = vi.fn((key: string) => key) as unknown as Parameters<typeof getChartTypes>[0];
    const result = getChartTypes(t);

    expect(result).toHaveLength(6);
    expect(result.map((r) => r.id)).toEqual(["area", "bar", "line", "pie", "big_number", "sentiment"]);
    expect(t).toHaveBeenCalledWith("workspace.analysis.charts.chart_type_area");
    expect(t).toHaveBeenCalledWith("workspace.analysis.charts.chart_type_sentiment");
    expect(result[0].label).toBe("workspace.analysis.charts.chart_type_area");
  });

  describe("getChartTypePrefillQuery", () => {
    test("pre-populates response count grouped by sentiment", () => {
      expect(getChartTypePrefillQuery("sentiment")).toEqual({
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sentiment"],
      });
    });

    test("returns a fresh object every call so re-picking the type re-applies it", () => {
      expect(getChartTypePrefillQuery("sentiment")).not.toBe(getChartTypePrefillQuery("sentiment"));
    });

    test("leaves shape-only chart types alone", () => {
      expect(getChartTypePrefillQuery("bar")).toBeUndefined();
      expect(getChartTypePrefillQuery("pie")).toBeUndefined();
      expect(getChartTypePrefillQuery("big_number")).toBeUndefined();
    });

    test("keeps a query that already groups by sentiment", () => {
      expect(
        getChartTypePrefillQuery("sentiment", {
          measures: ["FeedbackRecords.uniqueRespondents"],
          dimensions: ["FeedbackRecords.sentiment"],
        })
      ).toBeUndefined();
    });

    test("keeps a query that already measures the per-sentiment counts", () => {
      expect(
        getChartTypePrefillQuery("sentiment", {
          measures: ["FeedbackRecords.veryPositiveCount", "FeedbackRecords.negativeCount"],
        })
      ).toBeUndefined();
    });

    test("replaces a query that reads no sentiment at all", () => {
      expect(
        getChartTypePrefillQuery("sentiment", {
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.sourceType"],
        })
      ).toEqual({
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.sentiment"],
      });
    });
  });
});
