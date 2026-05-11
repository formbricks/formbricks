import { describe, expect, test } from "vitest";
import {
  CHART_BRAND_DARK,
  CHART_MEASURE_COLORS,
  allValuesAreIntegers,
  formatCellValue,
  formatXAxisTick,
  formatYAxisTick,
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

  describe("allValuesAreIntegers", () => {
    test("returns false for empty data or empty keys", () => {
      expect(allValuesAreIntegers([], ["count"])).toBe(false);
      expect(allValuesAreIntegers([{ count: 1 }], [])).toBe(false);
    });

    test("returns true when every value across keys is a whole number", () => {
      const data = [
        { source: "a", count: 2 },
        { source: "b", count: 5 },
      ];
      expect(allValuesAreIntegers(data, ["count"])).toBe(true);
    });

    test("treats numeric strings as their parsed value", () => {
      const data = [{ count: "12" }, { count: "8" }];
      expect(allValuesAreIntegers(data, ["count"])).toBe(true);
    });

    test("returns false when any value has a fractional part", () => {
      const data = [{ avg: 3.5 }, { avg: 4 }];
      expect(allValuesAreIntegers(data, ["avg"])).toBe(false);
    });

    test("skips null/undefined/empty-string but still counts other rows", () => {
      const data = [{ count: null }, { count: "" }, { count: 7 }];
      expect(allValuesAreIntegers(data, ["count"])).toBe(true);
    });

    test("returns false when every value is null (nothing to lock the axis on)", () => {
      const data = [{ count: null }, { count: undefined }];
      expect(allValuesAreIntegers(data, ["count"])).toBe(false);
    });

    test("requires all listed keys to be integers, not just one", () => {
      const data = [{ count: 5, avg: 3.2 }];
      expect(allValuesAreIntegers(data, ["count", "avg"])).toBe(false);
      expect(allValuesAreIntegers(data, ["count"])).toBe(true);
    });
  });

  describe("formatYAxisTick", () => {
    test("integers get thousand separators", () => {
      expect(formatYAxisTick(1000)).toBe("1,000");
      expect(formatYAxisTick(2)).toBe("2");
    });

    test("decimals preserve up to two fraction digits", () => {
      expect(formatYAxisTick(3.14159)).toBe("3.14");
    });

    test("non-finite numbers and non-strings render as empty", () => {
      expect(formatYAxisTick(null)).toBe("");
      expect(formatYAxisTick(Number.NaN)).toBe("");
      expect(formatYAxisTick({})).toBe("");
    });

    test("string values pass through unchanged", () => {
      expect(formatYAxisTick("abc")).toBe("abc");
    });
  });

  describe("constants", () => {
    test("CHART_MEASURE_COLORS has expected length", () => {
      expect(CHART_MEASURE_COLORS).toHaveLength(6);
      expect(CHART_MEASURE_COLORS[0]).toBe(CHART_BRAND_DARK);
    });
  });
});
