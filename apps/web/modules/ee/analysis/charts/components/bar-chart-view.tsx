"use client";

import { useTranslation } from "react-i18next";
import { Bar, BarChart, LabelList } from "recharts";
import {
  CartesianChart,
  type CartesianChartProps,
} from "@/modules/ee/analysis/charts/components/cartesian-chart";
import { getStackedBarRadius } from "@/modules/ee/analysis/charts/lib/chart-series";
import {
  CHART_BRAND_DARK,
  CHART_MEASURE_COLORS,
  PIVOTED_VALUE_KEY,
  getSemanticDimensionColor,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { type TValueFormatter, getPivotedMeasureChart } from "@/modules/ee/analysis/charts/lib/measure-pivot";
import type { YAxisScale } from "@/modules/ee/analysis/charts/lib/y-axis-scale";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";

interface BarChartViewProps extends Pick<
  CartesianChartProps,
  "timeAxis" | "responseBaseKey" | "seriesLabels" | "tooltipValueFormatter" | "valueAxisTickFormatter"
> {
  sortedData: TChartDataRow[];
  dataKeys: string[];
  isMultiMeasure: boolean;
  hasCategoryAxis: boolean;
  /** Draw one category per measure (see pivotsMeasuresIntoCategories). */
  pivotMeasures: boolean;
  xAxisKey: string;
  chartConfig: ChartConfig;
  formatDimensionValue: (value: unknown) => string;
  isHorizontal?: boolean;
  /** Stack several series into one bar per category instead of placing them side by side. */
  isStacked?: boolean;
  /** Precomputed value axis, for stacked bars whose axis has to fit the stack's total. */
  yAxisScale?: YAxisScale;
  formatValue: TValueFormatter;
  /** Short labels for a measure-only chart's bars, keyed by measure id (shared prefix dropped). */
  measureAxisLabels?: Record<string, string>;
  locale: string;
}

export const BarChartView = ({
  sortedData,
  dataKeys,
  isMultiMeasure,
  hasCategoryAxis,
  pivotMeasures,
  xAxisKey,
  chartConfig,
  formatDimensionValue,
  isHorizontal = false,
  isStacked = false,
  yAxisScale,
  timeAxis,
  responseBaseKey,
  seriesLabels,
  tooltipValueFormatter,
  valueAxisTickFormatter,
  formatValue,
  measureAxisLabels,
  locale,
}: Readonly<BarChartViewProps>) => {
  const { t } = useTranslation();
  // Value labels sit past the end of the bar, which is the top of a vertical bar and the
  // right-hand end of a horizontal one.
  const valueLabelPosition = isHorizontal ? "right" : "top";

  if (pivotMeasures) {
    const { chartProps, formatPointValue } = getPivotedMeasureChart({
      sortedData,
      dataKeys,
      measureAxisLabels,
      formatValue,
      locale,
      responseBaseKey,
      t,
    });
    return (
      <CartesianChart
        chart={BarChart}
        chartConfig={chartConfig}
        tooltipCursor={false}
        zeroBaseline
        horizontal={isHorizontal}
        {...chartProps}>
        <Bar dataKey={PIVOTED_VALUE_KEY} fill={CHART_BRAND_DARK} radius={4}>
          <LabelList
            position={valueLabelPosition}
            className="fill-foreground"
            fontSize={11}
            // No dataKey: with one set recharts ignores valueAccessor. Reading the row instead lets each
            // bar be formatted by its own measure.
            valueAccessor={(entry: { payload?: TChartDataRow }) => formatPointValue(entry.payload)}
          />
        </Bar>
      </CartesianChart>
    );
  }

  // Setting `fill` on the data row (not via <Cell>) is what propagates
  // the per-bar colour into the tooltip payload as well as the SVG.
  const barData = isMultiMeasure
    ? sortedData
    : sortedData.map((row, index) => ({
        ...row,
        fill:
          getSemanticDimensionColor(xAxisKey, row[xAxisKey]) ??
          CHART_MEASURE_COLORS[index % CHART_MEASURE_COLORS.length],
      }));

  return (
    <CartesianChart
      chart={BarChart}
      data={barData}
      xAxisKey={xAxisKey}
      dataKeys={dataKeys}
      chartConfig={chartConfig}
      showLegend={isMultiMeasure}
      tooltipCursor={false}
      zeroBaseline
      hasCategoryAxis={hasCategoryAxis}
      horizontal={isHorizontal}
      xAxisTickFormatter={formatDimensionValue}
      timeAxis={timeAxis}
      responseBaseKey={responseBaseKey}
      yAxisScale={yAxisScale}
      seriesLabels={seriesLabels}
      tooltipValueFormatter={tooltipValueFormatter}
      valueAxisTickFormatter={valueAxisTickFormatter}
      valueLabelFormatter={formatValue}
      chartProps={isMultiMeasure ? { barCategoryGap: "20%" } : {}}>
      {dataKeys.map((key, index) => (
        <Bar
          key={key}
          dataKey={key}
          fill={chartConfig[key]?.color}
          // A stack rounds only its outer end, so the segments read as one bar.
          radius={isStacked ? getStackedBarRadius(index === dataKeys.length - 1, isHorizontal) : 4}
          {...(isStacked ? { stackId: "stack" } : {})}>
          {!isMultiMeasure && (
            <LabelList
              dataKey={key}
              position={valueLabelPosition}
              className="fill-foreground"
              fontSize={11}
              formatter={(value: unknown) => formatValue(key, value)}
            />
          )}
        </Bar>
      ))}
    </CartesianChart>
  );
};
