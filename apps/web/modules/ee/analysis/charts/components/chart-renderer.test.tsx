import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import type { CartesianChartProps } from "@/modules/ee/analysis/charts/components/cartesian-chart";
import { PIVOTED_MEASURE_KEY, PIVOTED_VALUE_KEY } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { ChartRenderer } from "./chart-renderer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: "en-US", language: "en-US" } }),
}));

// Recharts draws nothing in jsdom (the container has no size), so the test reads what each view hands
// the shared cartesian chart: the rows and series it will draw.
const cartesianCalls: Omit<CartesianChartProps, "children" | "chart">[] = [];
vi.mock("@/modules/ee/analysis/charts/components/cartesian-chart", () => ({
  CartesianChart: ({ children: _children, chart: _chart, ...props }: CartesianChartProps & { children: ReactNode }) => {
    cartesianCalls.push(props);
    return null;
  },
}));

const NPS_AVERAGE = "FeedbackRecords.npsAverage";
const CSAT_AVERAGE = "FeedbackRecords.csatAverage";

// A measure-only query: no dimension or time grouping, so the result is one row with one column per measure.
const measureOnlyQuery: TChartQuery = { measures: [NPS_AVERAGE, CSAT_AVERAGE] };
const measureOnlyRow = { [NPS_AVERAGE]: 7.29, [CSAT_AVERAGE]: 3.93 };

const renderChart = (chartType: "bar" | "area", areaDisplay?: "line" | "area") => {
  render(
    <ChartRenderer
      chartType={chartType}
      data={[measureOnlyRow]}
      query={measureOnlyQuery}
      config={areaDisplay ? { areaDisplay } : {}}
    />
  );
  expect(cartesianCalls).toHaveLength(1);
  return cartesianCalls[0];
};

describe("ChartRenderer measure-only cartesian charts", () => {
  beforeEach(() => {
    cartesianCalls.length = 0;
  });
  afterEach(cleanup);

  test.each([
    ["bar", undefined],
    ["area", "area"],
    ["area", "line"],
  ] as const)("%s (%s) draws one point per measure along a measure axis", (chartType, areaDisplay) => {
    const props = renderChart(chartType, areaDisplay);

    // One category per measure, so a line or area has two points to join instead of one.
    expect(props.xAxisKey).toBe(PIVOTED_MEASURE_KEY);
    expect(props.dataKeys).toEqual([PIVOTED_VALUE_KEY]);
    expect(props.data.map((row) => [row[PIVOTED_MEASURE_KEY], row[PIVOTED_VALUE_KEY]])).toEqual([
      [NPS_AVERAGE, 7.29],
      [CSAT_AVERAGE, 3.93],
    ]);
    // The axis still pins to the measures' fixed scales (NPS 0–10), not to the pivoted values alone.
    expect(props.yAxisScale?.domain[1]).toBe(10);
  });

  test("a grouped area chart keeps one series per measure on its category axis", () => {
    render(
      <ChartRenderer
        chartType="area"
        data={[
          { "FeedbackRecords.sourceName": "web", [NPS_AVERAGE]: 7 },
          { "FeedbackRecords.sourceName": "app", [NPS_AVERAGE]: 8 },
        ]}
        query={{ measures: [NPS_AVERAGE], dimensions: ["FeedbackRecords.sourceName"] }}
        config={{ areaDisplay: "line" }}
      />
    );

    expect(cartesianCalls).toHaveLength(1);
    expect(cartesianCalls[0].xAxisKey).toBe("FeedbackRecords.sourceName");
    expect(cartesianCalls[0].dataKeys).toEqual([NPS_AVERAGE]);
    expect(cartesianCalls[0].data).toHaveLength(2);
  });
});
