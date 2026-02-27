import { describe, expect, test, vi } from "vitest";
import { CHART_TYPE_ICONS, getChartTypes } from "./chart-types";

describe("chart-types", () => {
  test("CHART_TYPE_ICONS has all chart types", () => {
    expect(Object.keys(CHART_TYPE_ICONS)).toEqual(["area", "bar", "line", "pie", "big_number"]);
  });

  test("getChartTypes returns chart types with translated labels", () => {
    const t = vi.fn((key: string) => key);
    const result = getChartTypes(t);

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.id)).toEqual(["area", "bar", "line", "pie", "big_number"]);
    expect(t).toHaveBeenCalledWith("environments.analysis.charts.chart_type_area");
    expect(result[0].label).toBe("environments.analysis.charts.chart_type_area");
  });
});
