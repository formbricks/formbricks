import { describe, expect, test, vi } from "vitest";
import { CHART_TYPE_ICONS, getChartTypes } from "./chart-types";

describe("chart-types", () => {
  test("CHART_TYPE_ICONS has all chart types", () => {
    expect(Object.keys(CHART_TYPE_ICONS)).toEqual(["area", "bar", "pie", "big_number"]);
  });

  test("getChartTypes returns chart types with translated labels", () => {
    const t = vi.fn((key: string) => key) as unknown as Parameters<typeof getChartTypes>[0];
    const result = getChartTypes(t);

    expect(result).toHaveLength(4);
    // Line is a display style of "area", not an entry of its own.
    expect(result.map((r) => r.id)).toEqual(["area", "bar", "pie", "big_number"]);
    expect(t).toHaveBeenCalledWith("workspace.analysis.charts.chart_type_area");
    expect(result[0].label).toBe("workspace.analysis.charts.chart_type_area");
  });
});
