"use client";

import { type ElementType, type ReactNode } from "react";
import { CartesianGrid, XAxis, YAxis } from "recharts";
import { formatXAxisTick } from "@/modules/ee/analysis/charts/lib/chart-utils";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@/modules/ui/components/chart";
import { PolishedChartTooltip } from "./polished-tooltip";

export interface CartesianChartProps {
  data: TChartDataRow[];
  xAxisKey: string;
  dataKeys: string[];
  chartConfig: ChartConfig;
  chart: ElementType;
  children: ReactNode;
  showLegend?: boolean;
  chartProps?: Record<string, unknown>;
  /**
   * Cursor prop forwarded to Recharts Tooltip. Set to `false` to suppress
   * the column highlight so bar-chart tooltips read as per-bar instead of
   * per-x. Defaults to Recharts' built-in cursor.
   */
  tooltipCursor?: boolean | Record<string, unknown>;
}

/**
 * Compute y-axis domain bounds from the actual data values with ~10% headroom
 * above the max and a small buffer below the min. Returns undefined when no
 * numeric values are present — leaving Recharts' default `auto` domain in
 * place — so empty datasets don't end up with a [0, 1] domain.
 */
const computeYDomain = (data: TChartDataRow[], dataKeys: string[]): [number, number] | undefined => {
  const values: number[] = [];
  for (const row of data) {
    for (const key of dataKeys) {
      const raw = row[key];
      if (raw === null || raw === undefined || raw === "") continue;
      const num = Number(raw);
      if (Number.isFinite(num)) values.push(num);
    }
  }
  if (values.length === 0) return undefined;
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = Math.max(dataMax - dataMin, 1); // never zero — flat data still gets padding
  const lower = Math.floor(dataMin - range * 0.05);
  const upper = Math.ceil(dataMax + range * 0.1);
  return [lower, upper];
};

/** Shared layout for bar, line, and area charts. Supports single or multiple measures. */
export function CartesianChart({
  data,
  xAxisKey,
  dataKeys,
  chartConfig,
  chart: Chart,
  children,
  showLegend = false,
  chartProps = {},
  tooltipCursor,
}: Readonly<CartesianChartProps>) {
  const yDomain = computeYDomain(data, dataKeys);

  return (
    <div className="h-full min-h-[16rem] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <Chart data={data} {...chartProps}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={formatXAxisTick}
          />
          {/* Static numeric domain computed up-front from data min/max with
              5% buffer below and 10% above. Bars touch the top of their
              column and line/area splines can overshoot the data max — both
              need explicit headroom so the chart container doesn't clip
              them. Pixel padding on top reinforces this for the spline case
              where overshoot can exceed the chosen tick. */}
          <YAxis tickLine={false} axisLine={false} padding={{ top: 16, bottom: 4 }} domain={yDomain} />
          <ChartTooltip content={<PolishedChartTooltip />} cursor={tooltipCursor} />
          {showLegend && <ChartLegend content={<ChartLegendContent />} verticalAlign="top" height={36} />}
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}
