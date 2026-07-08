import { describe, expect, test } from "vitest";
import {
  CHART_BRAND_DARK,
  CHART_MEASURE_COLORS,
  CHART_NOT_ENRICHED_COLOR,
  formatCellValue,
  formatXAxisTick,
  preparePieData,
  resolveChartType,
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

    test("drops zero-value rows alongside non-numeric ones", () => {
      const data = [
        { sentiment: "positive", count: 10 },
        { sentiment: "neutral", count: 0 },
        { sentiment: "skip", count: "n/a" },
      ];
      const result = preparePieData(data, "count");
      expect(result).not.toBeNull();
      expect(result!.processedData).toHaveLength(1);
      expect(result!.processedData[0].sentiment).toBe("positive");
    });

    test("colours slices from the mixed measure palette for distinguishability", () => {
      const data = [
        { sentiment: "positive", count: 10 },
        { sentiment: "negative", count: 5 },
        { sentiment: "skip", count: "n/a" },
      ];
      const result = preparePieData(data, "count");
      expect(result).not.toBeNull();
      expect(result!.processedData).toHaveLength(2);
      expect(result!.processedData[0].count).toBe(10);
      expect(result!.colors[0]).toBe(CHART_MEASURE_COLORS[0]);
      expect(result!.colors[1]).toBe(CHART_MEASURE_COLORS[1]);
    });

    test("greys the not-enriched slice and hands palette colours only to enriched slices", () => {
      const nameKey = "FeedbackRecords.sentiment";
      const data = [
        { [nameKey]: "", count: 20 }, // biggest → sorted first → not enriched
        { [nameKey]: "positive", count: 6 },
        { [nameKey]: "negative", count: 4 },
      ];
      const result = preparePieData(data, "count", nameKey);
      expect(result).not.toBeNull();
      // gray for the empty (not-enriched) slice; the palette is not consumed by it
      expect(result!.colors[0]).toBe(CHART_NOT_ENRICHED_COLOR);
      expect(result!.colors[1]).toBe(CHART_MEASURE_COLORS[0]);
      expect(result!.colors[2]).toBe(CHART_MEASURE_COLORS[1]);
    });

    test("uses palette colours when no nameKey is provided", () => {
      const data = [{ label: "A", count: 5 }];
      const result = preparePieData(data, "count");
      expect(result!.colors[0]).toBe(CHART_MEASURE_COLORS[0]);
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

    test("does not interpret bare year-shaped strings as dates", () => {
      // parseISO("1000") is a valid year-only ISO date and would render as
      // "Jan 1, 1000" — but a 4-digit numeric category label shouldn't be
      // turned into a date.
      expect(formatXAxisTick("1000")).toBe("1000");
      expect(formatXAxisTick("2024")).toBe("2024");
      expect(formatXAxisTick(1000)).toBe("1000");
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

  describe("constants", () => {
    test("CHART_MEASURE_COLORS has expected length", () => {
      expect(CHART_MEASURE_COLORS).toHaveLength(8);
      expect(CHART_MEASURE_COLORS[0]).toBe(CHART_BRAND_DARK);
    });

    test("CHART_MEASURE_COLORS has no duplicate hues", () => {
      expect(new Set(CHART_MEASURE_COLORS).size).toBe(CHART_MEASURE_COLORS.length);
    });
  });
});
