import { describe, expect, test } from "vitest";
import { resolveChartDisplay, sanitizeChartDisplay, supportsBarOrientation } from "./chart-display";

describe("resolveChartDisplay", () => {
  test("falls back to chart + vertical bars for charts saved before these settings existed", () => {
    expect(resolveChartDisplay({})).toEqual({ displayType: "chart", barOrientation: "vertical" });
    expect(resolveChartDisplay(undefined)).toEqual({ displayType: "chart", barOrientation: "vertical" });
    expect(resolveChartDisplay(null)).toEqual({ displayType: "chart", barOrientation: "vertical" });
  });

  test("returns the saved settings", () => {
    expect(resolveChartDisplay({ displayType: "table", barOrientation: "horizontal" })).toEqual({
      displayType: "table",
      barOrientation: "horizontal",
    });
  });

  test("fills in only the missing setting", () => {
    expect(resolveChartDisplay({ barOrientation: "horizontal" })).toEqual({
      displayType: "chart",
      barOrientation: "horizontal",
    });
    expect(resolveChartDisplay({ displayType: "table" })).toEqual({
      displayType: "table",
      barOrientation: "vertical",
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
    expect(sanitizeChartDisplay({ displayType: "chart", barOrientation: "horizontal" }, "bar")).toEqual({
      displayType: "chart",
      barOrientation: "horizontal",
    });
  });

  test("drops the orientation for chart types that cannot use it", () => {
    expect(sanitizeChartDisplay({ displayType: "table", barOrientation: "horizontal" }, "pie")).toEqual({
      displayType: "table",
    });
  });

  test("keeps settings that apply to every chart type", () => {
    expect(sanitizeChartDisplay({ displayType: "table" }, "line")).toEqual({ displayType: "table" });
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
