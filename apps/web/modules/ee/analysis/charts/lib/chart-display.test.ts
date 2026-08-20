import { describe, expect, test } from "vitest";
import { resolveChartDisplay, sanitizeChartDisplay, supportsBarOrientation } from "./chart-display";

describe("resolveChartDisplay", () => {
  test("falls back to vertical bars for charts saved before these settings existed", () => {
    expect(resolveChartDisplay({})).toEqual({ barOrientation: "vertical" });
    expect(resolveChartDisplay(undefined)).toEqual({ barOrientation: "vertical" });
    expect(resolveChartDisplay(null)).toEqual({ barOrientation: "vertical" });
  });

  test("returns the saved setting", () => {
    expect(resolveChartDisplay({ barOrientation: "horizontal" })).toEqual({
      barOrientation: "horizontal",
    });
  });
});

describe("supportsBarOrientation", () => {
  test("only bar charts have an orientation", () => {
    expect(supportsBarOrientation("bar")).toBe(true);
    expect(supportsBarOrientation("area")).toBe(false);
    expect(supportsBarOrientation("line")).toBe(false);
    expect(supportsBarOrientation("pie")).toBe(false);
    expect(supportsBarOrientation("big_number")).toBe(false);
    expect(supportsBarOrientation(undefined)).toBe(false);
  });
});

describe("sanitizeChartDisplay", () => {
  test("keeps the orientation on a bar chart", () => {
    expect(sanitizeChartDisplay({ barOrientation: "horizontal" }, "bar")).toEqual({
      barOrientation: "horizontal",
    });
  });

  test("drops the orientation for chart types that cannot use it", () => {
    expect(sanitizeChartDisplay({ barOrientation: "horizontal" }, "pie")).toEqual({});
  });

  test("preserves unrelated config fields", () => {
    expect(sanitizeChartDisplay({ xAxisLabel: "Question", barOrientation: "horizontal" }, "area")).toEqual({
      xAxisLabel: "Question",
    });
  });

  test("returns an empty config when nothing is set", () => {
    expect(sanitizeChartDisplay(undefined, "bar")).toEqual({});
    expect(sanitizeChartDisplay({}, "bar")).toEqual({});
  });
});
