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

/** Max width (px) a single x-axis label may occupy before wrapping. Keeps long question labels
 * from bleeding into neighbouring data points. */
const X_AXIS_TICK_WIDTH = 140;
/** Vertical space reserved for the (wrapped, up to 3-line) x-axis labels. */
const X_AXIS_HEIGHT = 56;

/** Recharts renders default ticks as SVG `<text>`, which cannot wrap. This custom tick uses a
 * `foreignObject` so long labels (e.g. full survey questions) wrap within a fixed max-width,
 * stay centred under their data point, and clamp to 3 lines with the full text on hover. */
function WrappingXAxisTick({
  x,
  y,
  payload,
  formatter,
}: Readonly<{
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  formatter: (value: unknown) => string;
}>) {
  const label = formatter(payload?.value);
  return (
    <foreignObject
      x={(x ?? 0) - X_AXIS_TICK_WIDTH / 2}
      y={(y ?? 0) + 4}
      width={X_AXIS_TICK_WIDTH}
      height={X_AXIS_HEIGHT}
      // Let the tooltip cursor win the pointer; the label is decorative.
      style={{ overflow: "visible", pointerEvents: "none" }}>
      <div
        title={label}
        className="text-muted-foreground line-clamp-3 text-center text-xs leading-tight"
        style={{ textWrap: "pretty" }}>
        {label}
      </div>
    </foreignObject>
  );
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
  const tickFormatter = xAxisTickFormatter ?? formatXAxisTick;

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
            // Label every data point (default recharts hides overlapping ticks, which dropped
            // long question labels on area/line charts) and wrap each label within a max-width.
            interval={hasCategoryAxis ? 0 : undefined}
            height={hasCategoryAxis ? X_AXIS_HEIGHT : undefined}
            tick={hasCategoryAxis ? <WrappingXAxisTick formatter={tickFormatter} /> : false}
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
