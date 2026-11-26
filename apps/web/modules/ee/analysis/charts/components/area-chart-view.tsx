"use client";

import { useId } from "react";
import { Area, AreaChart } from "recharts";
import {
  CartesianChart,
  type CartesianChartProps,
} from "@/modules/ee/analysis/charts/components/cartesian-chart";
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

/** Line is a display style of the area type, not a type of its own: both render the same Recharts
 * area series over the same axes and differ only in how the band under the stroke is painted. */
export function AreaChartView({
  rows,
  dataKeys,
  chartConfig,
  formatDimensionValue,
  isLine,
  isGrouped,
  ...axisProps
}: Readonly<AreaChartViewProps>) {
  // Unique across charts on the same page so SVG <defs> ids don't collide.
  const gradientIdPrefix = useId();

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
