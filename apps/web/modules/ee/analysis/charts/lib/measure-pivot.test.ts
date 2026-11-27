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
  // As one series per measure, a line or area has a single point per series and draws blank (ENG-2618).
  test.each(["bar", "area"] as const)("a measure-only %s chart draws one category per measure", (type) => {
    expect(pivotsMeasuresIntoCategories(type, false)).toBe(true);
  });

  test.each(["bar", "area"] as const)("a grouped %s chart keeps its category axis", (type) => {
    expect(pivotsMeasuresIntoCategories(type, true)).toBe(false);
  });

  test.each(["pie", "big_number"] as const)(
    "a %s chart never pivots: it draws its measures its own way",
    (type) => {
      expect(pivotsMeasuresIntoCategories(type, false)).toBe(false);
    }
  );
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

  test("formats the value axis and the value-label gutter by the measures' shared format", () => {
    const { chartProps } = pivot();

    // Averages share a decimal format: an axis tick keeps its fraction and groups in the locale.
    expect(chartProps.valueAxisTickFormatter?.(7.25)).toBe("7.25");
    expect(chartProps.valueAxisTickFormatter?.(1250)).toBe("1,250");
    expect(chartProps.valueLabelFormatter?.(PIVOTED_VALUE_KEY, 3.93)).toBe(`${NPS_AVERAGE}=3.93`);
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

  test("falls back to the column header for a measure without a short label, and to no measure for a foreign row", () => {
    const NPS_SCORE = "FeedbackRecords.npsScore";
    const COUNT = "FeedbackRecords.count";
    const { chartProps, formatPointValue } = getPivotedMeasureChart({
      sortedData: [{ [NPS_SCORE]: 40, [COUNT]: 12, "FeedbackRecords.npsCount": 10 }],
      dataKeys: [NPS_SCORE, COUNT],
      formatValue: (measure, value) => `${measure}=${String(value)}`,
      locale: "en-US",
      responseBaseKey: "FeedbackRecords.npsCount",
      t,
    });

    expect(chartProps.xAxisTickFormatter?.(NPS_SCORE)).toBe(
      "workspace.analysis.charts.field_label_nps_score"
    );
    expect(chartProps.xAxisTickFormatter?.(undefined)).toBe("");
    expect(chartProps.responseBaseKey).toBe("FeedbackRecords.npsCount");
    // A score and a count share no format, so the gutter falls back to the generic one.
    expect(chartProps.valueLabelFormatter?.(PIVOTED_VALUE_KEY, 12)).toBe("=12");
    expect(formatPointValue(undefined)).toBe("=undefined");
  });
});
