"use client";

import { type ElementType, type ReactNode } from "react";
import { CartesianGrid, XAxis, YAxis } from "recharts";
import { formatXAxisTick } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { computeYAxis } from "@/modules/ee/analysis/charts/lib/y-axis-scale";
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
  /** Force the y-axis to start at 0. Required for bars so length encodes magnitude correctly. */
  zeroBaseline?: boolean;
  /** Formats x-axis ticks and the tooltip header (e.g. enum dimension value labels). */
  xAxisTickFormatter?: (value: unknown) => string;
  /** False for measure-only charts with no real category: hides the meaningless x-axis tick and
   * tooltip header (which would otherwise show the fallback measure value, e.g. a stray "1"). */
  hasCategoryAxis?: boolean;
  /** Overrides whether the tooltip header is hidden (defaults to `!hasCategoryAxis`). Pivoted
   * measure charts keep their category axis but hide the header, since each tooltip row already
   * carries the measure label and a header would just repeat it. */
  tooltipHideLabel?: boolean;
}

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
  zeroBaseline = false,
  xAxisTickFormatter,
  hasCategoryAxis = true,
  tooltipHideLabel,
}: Readonly<CartesianChartProps>) {
  const yScale = computeYAxis(data, dataKeys, zeroBaseline);

  return (
    <div className="h-full min-h-64 w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <Chart data={data} {...chartProps}>
          {/* syncWithTicks: draw a gridline only at each tick. Without it Recharts adds
              extra lines at the plot-area top/bottom edges (revealed by the YAxis padding),
              which showed up as unlabelled boundary lines above 80 and below 0. */}
          <CartesianGrid strokeDasharray="2 4" vertical={false} syncWithTicks />
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tick={hasCategoryAxis}
            tickFormatter={xAxisTickFormatter ?? formatXAxisTick}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            padding={{ top: 16, bottom: 4 }}
            domain={yScale?.domain}
            ticks={yScale?.ticks}
            interval={0}
          />
          <ChartTooltip
            content={
              <PolishedChartTooltip
                labelFormatter={xAxisTickFormatter}
                hideLabel={tooltipHideLabel ?? !hasCategoryAxis}
              />
            }
            cursor={tooltipCursor}
            // Measure-only charts (no category) have one bar per measure, so a shared tooltip would
            // dump every measure at once with no way to tell which bar is which. Scope it to the
            // hovered bar instead. Category charts keep the shared tooltip to compare within a group.
            shared={hasCategoryAxis}
          />
          {showLegend && <ChartLegend content={<ChartLegendContent />} verticalAlign="bottom" height={36} />}
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}
