import { describe, expect, test } from "vitest";
import {
  resolveChartDisplay,
  sanitizeChartDisplay,
  supportsBarOrientation,
  supportsPieDisplay,
} from "./chart-display";

describe("resolveChartDisplay", () => {
  test("falls back to vertical bars for charts saved before these settings existed", () => {
    expect(resolveChartDisplay({})).toEqual({ barOrientation: "vertical", pieDisplay: "pie" });
    expect(resolveChartDisplay(undefined)).toEqual({ barOrientation: "vertical", pieDisplay: "pie" });
    expect(resolveChartDisplay(null)).toEqual({ barOrientation: "vertical", pieDisplay: "pie" });
  });

  test("returns the saved setting", () => {
    expect(resolveChartDisplay({ barOrientation: "horizontal" })).toEqual({
      barOrientation: "horizontal",
      pieDisplay: "pie",
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

describe("pie display", () => {
  test("falls back to the pie for charts saved before this setting existed", () => {
    expect(resolveChartDisplay({}).pieDisplay).toBe("pie");
    expect(resolveChartDisplay(undefined).pieDisplay).toBe("pie");
  });

  test("returns the saved setting", () => {
    expect(resolveChartDisplay({ pieDisplay: "breakdown" }).pieDisplay).toBe("breakdown");
  });

  test("only a pie chart supports it", () => {
    expect(supportsPieDisplay("pie")).toBe(true);
    expect(supportsPieDisplay("bar")).toBe(false);
    expect(supportsPieDisplay(undefined)).toBe(false);
  });

  test("keeps the setting for a pie and drops it for anything else", () => {
    expect(sanitizeChartDisplay({ pieDisplay: "breakdown" }, "pie")).toEqual({
      pieDisplay: "breakdown",
    });
    // Switching a breakdown pie to a bar chart must not leave the setting behind to surprise
    // whoever switches it back.
    expect(sanitizeChartDisplay({ pieDisplay: "breakdown" }, "bar")).toEqual({});
  });

  test("each chart type keeps only its own setting", () => {
    expect(sanitizeChartDisplay({ barOrientation: "horizontal", pieDisplay: "breakdown" }, "pie")).toEqual({
      pieDisplay: "breakdown",
    });
    expect(sanitizeChartDisplay({ barOrientation: "horizontal", pieDisplay: "breakdown" }, "bar")).toEqual({
      barOrientation: "horizontal",
    });
  });

  test("preserves unrelated config either way", () => {
    expect(sanitizeChartDisplay({ pieDisplay: "breakdown", showLegend: true }, "pie")).toEqual({
      pieDisplay: "breakdown",
      showLegend: true,
    });
  });
});
