import { describe, expect, test } from "vitest";
import {
  hasChartDisplaySettings,
  resolveChartDisplay,
  sanitizeChartDisplay,
  supportsAreaDisplay,
  supportsBarOrientation,
  supportsPieDisplay,
  supportsTimeGrouping,
} from "./chart-display";

describe("resolveChartDisplay", () => {
  test("falls back to vertical bars for charts saved before these settings existed", () => {
    const defaults = { barOrientation: "vertical", pieDisplay: "pie", areaDisplay: "filled" };
    expect(resolveChartDisplay({})).toEqual(defaults);
    expect(resolveChartDisplay(undefined)).toEqual(defaults);
    expect(resolveChartDisplay(null)).toEqual(defaults);
  });

  test("returns the saved setting", () => {
    expect(resolveChartDisplay({ barOrientation: "horizontal" })).toEqual({
      barOrientation: "horizontal",
      pieDisplay: "pie",
      areaDisplay: "filled",
    });
  });
});

describe("supportsBarOrientation", () => {
  test("only bar charts have an orientation", () => {
    expect(supportsBarOrientation("bar")).toBe(true);
    expect(supportsBarOrientation("area")).toBe(false);
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

describe("area display", () => {
  test("falls back to the filled area for charts saved before Line merged into Area", () => {
    expect(resolveChartDisplay({}).areaDisplay).toBe("filled");
    expect(resolveChartDisplay(undefined).areaDisplay).toBe("filled");
  });

  test("returns the saved setting", () => {
    expect(resolveChartDisplay({ areaDisplay: "line" }).areaDisplay).toBe("line");
  });

  test("only an area chart supports it", () => {
    expect(supportsAreaDisplay("area")).toBe(true);
    expect(supportsAreaDisplay("bar")).toBe(false);
    expect(supportsAreaDisplay("pie")).toBe(false);
    expect(supportsAreaDisplay("big_number")).toBe(false);
    expect(supportsAreaDisplay(undefined)).toBe(false);
  });

  test("keeps the setting for an area chart and drops it for anything else", () => {
    expect(sanitizeChartDisplay({ areaDisplay: "line" }, "area")).toEqual({ areaDisplay: "line" });
    expect(sanitizeChartDisplay({ areaDisplay: "line" }, "bar")).toEqual({});
  });

  test("each chart type keeps only its own setting", () => {
    expect(sanitizeChartDisplay({ areaDisplay: "line", barOrientation: "horizontal" }, "area")).toEqual({
      areaDisplay: "line",
    });
    expect(sanitizeChartDisplay({ areaDisplay: "line", barOrientation: "horizontal" }, "bar")).toEqual({
      barOrientation: "horizontal",
    });
  });

  test("preserves unrelated config either way", () => {
    expect(sanitizeChartDisplay({ areaDisplay: "line", showLegend: true }, "area")).toEqual({
      areaDisplay: "line",
      showLegend: true,
    });
  });
});

describe("supportsTimeGrouping", () => {
  test("big number and pie are point-in-time snapshots, not trends", () => {
    expect(supportsTimeGrouping("big_number")).toBe(false);
    expect(supportsTimeGrouping("pie")).toBe(false);
  });

  test("bar and area/line can show a trend over time", () => {
    expect(supportsTimeGrouping("bar")).toBe(true);
    expect(supportsTimeGrouping("area")).toBe(true);
  });

  test("defaults to supported when the chart type is unknown", () => {
    expect(supportsTimeGrouping(undefined)).toBe(true);
  });
});

describe("hasChartDisplaySettings", () => {
  test("is true only for the types that own a setting", () => {
    expect(hasChartDisplaySettings("bar")).toBe(true);
    expect(hasChartDisplaySettings("pie")).toBe(true);
    // No "line" case: main folded line into area, toggled through areaDisplay.
    expect(hasChartDisplaySettings("area")).toBe(true);
    expect(hasChartDisplaySettings("big_number")).toBe(false);
    expect(hasChartDisplaySettings(undefined)).toBe(false);
  });
});
