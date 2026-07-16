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

const TARGET_TICK_COUNT = 5;

interface YAxisScale {
  domain: [number, number];
  ticks: number[];
}

// Round a value to a "nice" number (1/2/5/10 × 10ⁿ) — the family of steps people
// expect on an axis. `round` snaps to the nearest nice number; otherwise it rounds
// up so the value fully contains the range.
const niceNum = (value: number, round: boolean): number => {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * 10 ** exponent;
};

const computeYAxis = (
  data: TChartDataRow[],
  dataKeys: string[],
  zeroBaseline: boolean
): YAxisScale | undefined => {
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

  // Baseline: bars and all-positive series sit on 0; only dip below zero when the
  // data genuinely does, so we never draw a phantom negative axis (e.g. a -4 floor
  // under a metric that bottoms out at 0).
  const baselineLow = zeroBaseline ? Math.min(0, dataMin) : dataMin;
  // Flat data has no range to scale, so give it a unit of headroom to render ticks.
  const spanHigh = dataMax === baselineLow ? baselineLow + 1 : dataMax;

  // Snap the axis to nice bounds and derive evenly spaced round ticks, so every
  // gridline lands on a labelled value. (Recharts' auto-ticks are computed from a
  // raw domain and can fall outside it, drawing extra gridlines with no label.)
  const step = niceNum(niceNum(spanHigh - baselineLow, false) / (TARGET_TICK_COUNT - 1), true);
  const niceMin = Math.floor(baselineLow / step) * step;
  const niceMax = Math.ceil(spanHigh / step) * step;

  // Clean up floating-point noise that decimal steps introduce (e.g. 0.30000000004).
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const round = (n: number) => Number(n.toFixed(decimals));

  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax + step / 2; tick += step) {
    ticks.push(round(tick));
  }

  return { domain: [round(niceMin), round(niceMax)], ticks };
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
