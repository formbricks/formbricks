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
  /** Forwarded to Recharts Tooltip `cursor`. Pass `false` for per-bar bar charts. */
  tooltipCursor?: boolean | Record<string, unknown>;
}

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
  // Flat data still needs visible headroom, so floor the range at 1.
  const range = Math.max(dataMax - dataMin, 1);
  return [Math.floor(dataMin - range * 0.05), Math.ceil(dataMax + range * 0.1)];
};

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
          <YAxis tickLine={false} axisLine={false} padding={{ top: 16, bottom: 4 }} domain={yDomain} />
          <ChartTooltip content={<PolishedChartTooltip />} cursor={tooltipCursor} />
          {showLegend && <ChartLegend content={<ChartLegendContent />} verticalAlign="top" height={36} />}
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}
