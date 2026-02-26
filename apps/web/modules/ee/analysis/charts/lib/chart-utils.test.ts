import { describe, expect, test } from "vitest";
import {
  CHART_BRAND_DARK,
  CHART_MEASURE_COLORS,
  formatCellValue,
  formatXAxisTick,
  preparePieData,
  resolveChartType,
  validateQueryMembers,
} from "./chart-utils";

describe("chart-utils", () => {
  describe("resolveChartType", () => {
    test("returns valid chart types", () => {
      expect(resolveChartType("area")).toBe("area");
      expect(resolveChartType("bar")).toBe("bar");
      expect(resolveChartType("line")).toBe("line");
      expect(resolveChartType("pie")).toBe("pie");
      expect(resolveChartType("big_number")).toBe("big_number");
    });

    test("defaults to bar for invalid type", () => {
      expect(resolveChartType("invalid")).toBe("bar");
      expect(resolveChartType("")).toBe("bar");
    });
  });

  describe("preparePieData", () => {
    test("returns null for empty or no valid numeric data", () => {
      expect(preparePieData([], "count")).toBeNull();
      expect(preparePieData([{ label: "A", count: "text" }], "count")).toBeNull();
      expect(preparePieData([{ label: "A", count: null }], "count")).toBeNull();
    });

    test("filters to numeric rows and returns processedData with colors", () => {
      const data = [
        { sentiment: "positive", count: 10 },
        { sentiment: "negative", count: 5 },
        { sentiment: "skip", count: "n/a" },
      ];
      const result = preparePieData(data, "count");
      expect(result).not.toBeNull();
      expect(result!.processedData).toHaveLength(2);
      expect(result!.processedData[0].count).toBe(10);
      expect(result!.colors[0]).toBe(CHART_BRAND_DARK);
      expect(result!.colors[1]).toBe("#00E6CA");
    });
  });

  describe("formatXAxisTick", () => {
    test("returns empty for null/undefined", () => {
      expect(formatXAxisTick(null)).toBe("");
      expect(formatXAxisTick(undefined)).toBe("");
    });

    test("formats ISO date string", () => {
      expect(formatXAxisTick("2024-06-15")).toMatch(/Jun \d+, 2024/);
    });

    test("passes through non-date string", () => {
      expect(formatXAxisTick("hello")).toBe("hello");
    });

    test("formats number as string when it parses as date, else passes through", () => {
      expect(formatXAxisTick(1.5)).toBe("1.5");
    });

    test("returns empty for boolean", () => {
      expect(formatXAxisTick(true)).toBe("");
    });
  });

  describe("formatCellValue", () => {
    test("returns empty for null/undefined", () => {
      expect(formatCellValue(null)).toBe("");
      expect(formatCellValue(undefined)).toBe("");
    });

    test("formats number with locale", () => {
      expect(formatCellValue(1000)).toBe("1,000");
      expect(formatCellValue(3.14)).toBe("3.14");
    });

    test("formats ISO date string", () => {
      expect(formatCellValue("2024-01-15")).toMatch(/Jan \d+, 2024/);
    });

    test("returns string as-is when not date", () => {
      expect(formatCellValue("hello")).toBe("hello");
    });

    test("stringifies object", () => {
      expect(formatCellValue({ a: 1 })).toBe('{"a":1}');
    });

    test("converts boolean and bigint", () => {
      expect(formatCellValue(true)).toBe("true");
      expect(formatCellValue(123n)).toBe("123");
    });
  });

  describe("validateQueryMembers", () => {
    test("does not throw for valid query", () => {
      expect(() =>
        validateQueryMembers({
          measures: ["FeedbackRecords.count"],
          dimensions: ["FeedbackRecords.sentiment"],
          timeDimensions: [{ dimension: "FeedbackRecords.collectedAt" }],
          filters: [{ member: "FeedbackRecords.sourceType", operator: "equals", values: ["survey"] }],
        })
      ).not.toThrow();
    });

    test("throws for invalid measure", () => {
      expect(() => validateQueryMembers({ measures: ["Other.count"] })).toThrow(
        /Invalid query members.*Other\.count/
      );
    });

    test("throws for invalid dimension", () => {
      expect(() => validateQueryMembers({ dimensions: ["TopicsUnnested.topic"] })).toThrow(
        /Invalid query members.*TopicsUnnested\.topic/
      );
    });

    test("throws for invalid filter member", () => {
      expect(() =>
        validateQueryMembers({
          filters: [{ member: "Invalid.field", operator: "equals", values: ["x"] }],
        })
      ).toThrow(/Invalid query members/);
    });
  });

  describe("constants", () => {
    test("CHART_MEASURE_COLORS has expected length", () => {
      expect(CHART_MEASURE_COLORS).toHaveLength(6);
      expect(CHART_MEASURE_COLORS[0]).toBe(CHART_BRAND_DARK);
    });
  });
});
