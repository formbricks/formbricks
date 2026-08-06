"use client";

import { type ElementType, type ReactNode } from "react";
import { CartesianGrid, XAxis, YAxis } from "recharts";
import { formatXAxisTick } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { type YAxisScale, computeYAxis } from "@/modules/ee/analysis/charts/lib/y-axis-scale";
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
  /** Precomputed Y-axis scale, used in place of deriving one from `data`/`dataKeys`. Measure-pivot
   * charts render values under a synthetic key (PIVOTED_VALUE_KEY) that carries no measure id, so
   * they resolve the fixed-scale axis from the original measure columns and pass it here (ENG-2226). */
  yAxisScale?: YAxisScale;
}

/** Upper bound (px) on a single x-axis label before wrapping. Keeps long question labels from
 * bleeding into neighbouring data points on charts with few categories. */
const X_AXIS_TICK_MAX_WIDTH = 140;
/** Lower bound (px) so a label keeps a little room to wrap even on very dense axes. Below the band
 * width the label narrows to fit rather than overlapping its neighbours. */
const X_AXIS_TICK_MIN_WIDTH = 32;
/** Horizontal gap (px) reserved between adjacent labels so wrapped text never touches. */
const X_AXIS_TICK_GAP = 8;
/** Vertical space reserved for the x-axis labels: enough for 3 wrapped lines of `text-xs`
 * (~15px each) plus the tick margin and top offset below the axis, so the third line is not
 * clipped by the plot's bottom edge. */
const X_AXIS_HEIGHT = 72;

/** Recharts renders default ticks as SVG `<text>`, which cannot wrap. This custom tick uses a
 * `foreignObject` so long labels (e.g. full survey questions) wrap within a max-width, stay centred
 * under their data point, and clamp to 3 lines with the full text on hover. The width is derived
 * from the per-category band (`width / visibleTicksCount`, both injected by Recharts' CartesianAxis)
 * so labels shrink to fit as categories are added instead of overlapping each other. */
function WrappingXAxisTick({
  x,
  y,
  payload,
  formatter,
  width,
  visibleTicksCount,
}: Readonly<{
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  formatter: (value: unknown) => string;
  width?: number;
  visibleTicksCount?: number;
}>) {
  const label = formatter(payload?.value);
  const band = width && visibleTicksCount ? width / visibleTicksCount : X_AXIS_TICK_MAX_WIDTH;
  const tickWidth = Math.min(X_AXIS_TICK_MAX_WIDTH, Math.max(X_AXIS_TICK_MIN_WIDTH, band - X_AXIS_TICK_GAP));
  return (
    <foreignObject
      x={(x ?? 0) - tickWidth / 2}
      y={(y ?? 0) + 4}
      width={tickWidth}
      height={X_AXIS_HEIGHT}
      // Keep the label hit-testable so the `title` full-text tooltip works on hover. The tick sits
      // in the axis band below the plot, so this doesn't intercept hover over the bars/points.
      style={{ overflow: "visible" }}>
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
  yAxisScale,
}: Readonly<CartesianChartProps>) {
  const yScale = yAxisScale ?? computeYAxis(data, dataKeys, zeroBaseline);
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
