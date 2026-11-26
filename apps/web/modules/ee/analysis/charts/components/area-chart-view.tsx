"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, LabelList } from "recharts";
import {
  CartesianChart,
  type CartesianChartProps,
} from "@/modules/ee/analysis/charts/components/cartesian-chart";
import { CHART_BRAND_DARK, PIVOTED_VALUE_KEY } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { type TValueFormatter, getPivotedMeasureChart } from "@/modules/ee/analysis/charts/lib/measure-pivot";
import { getAreaFillOpacity } from "@/modules/ee/analysis/charts/lib/series-model";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

interface AreaChartViewProps extends Pick<
  CartesianChartProps,
  | "xAxisKey"
  | "dataKeys"
  | "chartConfig"
  | "hasCategoryAxis"
  | "timeAxis"
  | "responseBaseKey"
  | "seriesLabels"
  | "tooltipValueFormatter"
  | "valueAxisTickFormatter"
  | "yAxisScale"
> {
  rows: TChartDataRow[];
  formatDimensionValue: (value: unknown) => string;
  isLine: boolean;
  isGrouped: boolean;
  /** Draw one category per measure (see pivotsMeasuresIntoCategories). */
  pivotMeasures: boolean;
  formatValue: TValueFormatter;
  /** Short labels for a measure-only chart's points, keyed by measure id (shared prefix dropped). */
  measureAxisLabels?: Record<string, string>;
  locale: string;
}

/** The fill under the line style's stroke: a gradient that fades to nothing. */
function LineGradient({ id, color }: Readonly<{ id: string; color?: string }>) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
      <stop offset="95%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

/** Text anchor for a point's value label. On a point scale the first and last points sit on the plot's
 * edges, so a centred label there is clipped by the edge or drawn over the value axis; those anchor
 * inward, the way the category axis anchors its edge labels. A lone point sits mid-plot. */
const getPointLabelAnchor = (index: number, count: number): "start" | "middle" | "end" => {
  if (count < 2) return "middle";
  if (index === 0) return "start";
  if (index === count - 1) return "end";
  return "middle";
};

/** Gap (px) between a point and its value label. */
const POINT_LABEL_OFFSET = 10;

interface PointLabelProps {
  readonly x?: number | string;
  readonly y?: number | string;
  readonly value?: number | string;
  readonly index?: number;
}

// Curried with the point count: recharts calls the renderer per point, and the anchor depends on
// where the point sits among all of them.
const createPointLabelRenderer = (pointCount: number) =>
  function PointLabel({ x, y, value, index }: PointLabelProps) {
    if (value == null || value === "") return null;
    return (
      <text
        x={Number(x)}
        y={Number(y) - POINT_LABEL_OFFSET}
        textAnchor={getPointLabelAnchor(index ?? 0, pointCount)}
        className="fill-foreground"
        fontSize={11}>
        {value}
      </text>
    );
  };

/** Line is a display style of the area type, not a type of its own: both render the same Recharts
 * area series over the same axes and differ only in how the band under the stroke is painted. */
export function AreaChartView({
  rows,
  dataKeys,
  chartConfig,
  formatDimensionValue,
  isLine,
  isGrouped,
  pivotMeasures,
  formatValue,
  measureAxisLabels,
  locale,
  ...axisProps
}: Readonly<AreaChartViewProps>) {
  const { t } = useTranslation();
  // Unique across charts on the same page so SVG <defs> ids don't collide.
  const gradientIdPrefix = useId();

  // A measure-only result is one row: as one series per measure, each series has a single point and
  // nothing to join, so the chart draws blank (ENG-2618). Pivoted like the bar chart, the measures
  // become the categories and one line runs through them.
  if (pivotMeasures) {
    const { chartProps, formatPointValue } = getPivotedMeasureChart({
      sortedData: rows,
      dataKeys,
      measureAxisLabels,
      formatValue,
      locale,
      responseBaseKey: axisProps.responseBaseKey,
      t,
    });
    const gradientId = `${gradientIdPrefix}-line-${PIVOTED_VALUE_KEY}`;
    // The pivot colours each measure for the bars; one line has one colour, and the tooltip's dot
    // reads a row's fill before the series colour, so drop it.
    const lineData = chartProps.data.map(({ fill: _fill, ...row }) => row);
    const pointCount = lineData.length;
    return (
      <CartesianChart
        chart={AreaChart}
        chartConfig={chartConfig}
        // Edge axis labels anchor inward to stay inside the plot; a lone point's label centres under it.
        pointScale={pointCount > 1}
        {...chartProps}
        data={lineData}>
        {isLine ? (
          <defs>
            <LineGradient id={gradientId} color={CHART_BRAND_DARK} />
          </defs>
        ) : null}
        <Area
          type="monotone"
          dataKey={PIVOTED_VALUE_KEY}
          stroke={CHART_BRAND_DARK}
          strokeWidth={2}
          fill={isLine ? `url(#${gradientId})` : CHART_BRAND_DARK}
          fillOpacity={getAreaFillOpacity(isLine, false)}
          // Every point is a measure, so each is drawn: a chart of one measure still shows its value.
          dot={{ r: 4, fill: CHART_BRAND_DARK, stroke: CHART_BRAND_DARK }}
          activeDot={{ r: 5, stroke: CHART_BRAND_DARK, strokeWidth: 2, fill: "#fff" }}
          // A measure that computed to NULL is a gap, not a dip to zero.
          connectNulls={false}>
          <LabelList
            // No dataKey: with one set recharts ignores valueAccessor. Reading the row instead lets each
            // point be formatted by its own measure.
            valueAccessor={(entry: { payload?: TChartDataRow }) => formatPointValue(entry.payload)}
            content={createPointLabelRenderer(pointCount)}
          />
        </Area>
      </CartesianChart>
    );
  }

  return (
    <CartesianChart
      chart={AreaChart}
      data={rows}
      dataKeys={dataKeys}
      chartConfig={chartConfig}
      showLegend
      xAxisTickFormatter={formatDimensionValue}
      pointScale
      {...axisProps}>
      {isLine ? (
        <defs>
          {dataKeys.map((key) => (
            <LineGradient key={key} id={`${gradientIdPrefix}-line-${key}`} color={chartConfig[key]?.color} />
          ))}
        </defs>
      ) : null}
      {dataKeys.map((key) => {
        const color = chartConfig[key]?.color;
        return (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            // A thin stroke over a gradient that fades to nothing reads as a line with a soft
            // tint; a flat fill reads as an area. 0.6 is Recharts' own default, spelled out
            // here so the line style keeps the tint it had as a separate chart type.
            fill={isLine ? `url(#${gradientIdPrefix}-line-${key})` : color}
            fillOpacity={getAreaFillOpacity(isLine, isGrouped)}
            dot={false}
            activeDot={isLine ? { r: 5, stroke: color, strokeWidth: 2, fill: "#fff" } : undefined}
            // Cube returns null for empty buckets; render them as gaps, not a dip to zero.
            connectNulls={false}
          />
        );
      })}
    </CartesianChart>
  );
}
