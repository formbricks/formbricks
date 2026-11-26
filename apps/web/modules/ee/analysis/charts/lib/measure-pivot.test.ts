import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { PIVOTED_MEASURE_KEY, PIVOTED_VALUE_KEY } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { getPivotedMeasureChart, pivotsMeasuresIntoCategories } from "./measure-pivot";

const NPS_AVERAGE = "FeedbackRecords.npsAverage";
const CSAT_AVERAGE = "FeedbackRecords.csatAverage";

// A measure-only query (no dimension or time grouping) returns one row with one column per measure.
const measureOnlyRow = { [NPS_AVERAGE]: 7.29, [CSAT_AVERAGE]: 3.93 };

const t = ((key: string) => key) as unknown as TFunction;

describe("pivotsMeasuresIntoCategories", () => {
  test("a measure-only bar chart draws one category per measure", () => {
    expect(pivotsMeasuresIntoCategories("bar", false)).toBe(true);
  });

  test.each(["bar", "area"] as const)("a grouped %s chart keeps its category axis", (type) => {
    expect(pivotsMeasuresIntoCategories(type, true)).toBe(false);
  });

  test.each(["pie", "big_number"] as const)("a %s chart folds its measures itself", (type) => {
    expect(pivotsMeasuresIntoCategories(type, false)).toBe(false);
  });
});

describe("getPivotedMeasureChart", () => {
  const pivot = () =>
    getPivotedMeasureChart({
      sortedData: [measureOnlyRow],
      dataKeys: [NPS_AVERAGE, CSAT_AVERAGE],
      measureAxisLabels: { [NPS_AVERAGE]: "NPS", [CSAT_AVERAGE]: "CSAT" },
      formatValue: (measure, value) => `${measure}=${String(value)}`,
      locale: "en-US",
      t,
    });

  test("puts each measure on the category axis with its value", () => {
    const { chartProps } = pivot();

    expect(chartProps.xAxisKey).toBe(PIVOTED_MEASURE_KEY);
    expect(chartProps.dataKeys).toEqual([PIVOTED_VALUE_KEY]);
    expect(chartProps.data.map((row) => [row[PIVOTED_MEASURE_KEY], row[PIVOTED_VALUE_KEY]])).toEqual([
      [NPS_AVERAGE, 7.29],
      [CSAT_AVERAGE, 3.93],
    ]);
    expect(chartProps.xAxisTickFormatter?.(NPS_AVERAGE)).toBe("NPS");
  });

  test("pins the value axis to the measures' fixed scales, not to the pivoted values (ENG-2226)", () => {
    expect(pivot().chartProps.yAxisScale?.domain[1]).toBe(10);
  });

  test("formats each point and tooltip row by its own measure", () => {
    const { chartProps, formatPointValue } = pivot();
    const [nps, csat] = chartProps.data;

    expect(formatPointValue(nps)).toBe(`${NPS_AVERAGE}=7.29`);
    expect(formatPointValue(csat)).toBe(`${CSAT_AVERAGE}=3.93`);
    expect(chartProps.tooltipValueFormatter?.(PIVOTED_VALUE_KEY, 3.93, csat)).toBe(`${CSAT_AVERAGE}=3.93`);
    // Each tooltip row already names its measure, so the header is hidden.
    expect(chartProps.tooltipHideLabel).toBe(true);
  });
});
