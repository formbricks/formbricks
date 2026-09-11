"use client";

import { type ElementType, type ReactNode, useMemo } from "react";
import { CartesianGrid, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/cn";
import {
  AXIS_LABEL_BOX_HEIGHT,
  AXIS_LABEL_GAP,
  AXIS_LABEL_MAX_LINES,
  CHART_LEGEND_HEIGHT,
  formatCellValue,
  formatXAxisTick,
  getCategoryAxisWidth,
  getCategoryLabelBoxHeight,
  getCategoryLabelLineClamp,
  getFlippedChartMinHeight,
  getValueLabelPadding,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
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
  /** True for point-scale charts (line/area) where the first/last categories sit on the plot
   * boundary. Anchors the edge x-axis labels inward so they aren't clipped by the plot edge.
   * Leave false for band-scale charts (bars), whose edge categories are already inset. */
  pointScale?: boolean;
  /** Flips the chart onto its side: categories run down the y-axis and values across the x-axis.
   * Bar charts only — the category labels move into a gutter on the left, sized to the labels
   * present and wrapped inside it (see `getCategoryAxisWidth`). The chart also claims a minimum
   * height per category and scrolls past it, so a long label wraps the same way on a dense chart as
   * on a sparse one (see `getFlippedChartMinHeight`). */
  horizontal?: boolean;
}

/** Upper bound (px) on a single x-axis label before wrapping. The per-category band clamp below
 * already stops neighbours colliding, so this is only a ceiling for charts with lots of room (few
 * categories) — kept generous so long question labels show as much as possible before truncating. */
const X_AXIS_TICK_MAX_WIDTH = 220;
/** Lower bound (px) so a label keeps a little room to wrap even on very dense axes. Below the band
 * width the label narrows to fit rather than overlapping its neighbours. */
const X_AXIS_TICK_MIN_WIDTH = 32;
/** Vertical space reserved on the axis for the labels: the label box plus the tick margin and the
 * box's top offset below the axis line, so the last line is not clipped by the plot's bottom edge.
 * The box height itself is the shared `AXIS_LABEL_BOX_HEIGHT`: just the clamped text, so on
 * legend-less charts (bars) the box does not overhang the plot below the labels. */
const X_AXIS_RESERVED_HEIGHT = AXIS_LABEL_BOX_HEIGHT + 24;
/** Vertical offset (px) of the label box below the axis line. */
const X_AXIS_LABEL_TOP_OFFSET = 4;

/** Recharts renders default ticks as SVG `<text>`, which cannot wrap. This custom tick uses a
 * `foreignObject` so long labels (e.g. full survey questions) wrap within a max-width, stay under
 * their data point, and clamp to 3 lines with the full text on hover. The width is derived from the
 * per-category band (`width / visibleTicksCount`, both injected by Recharts' CartesianAxis) so
 * labels shrink to fit as categories are added instead of overlapping each other.
 *
 * `pointScale` charts (line/area) place the first and last categories *on* the plot boundary, so a
 * centred label there would spill half its width past the SVG edge and get clipped. For those edge
 * ticks we anchor the box inward (left-align the first, right-align the last) instead of centring,
 * which keeps the full label inside the plot. Band-scale charts (bars) inset their edge categories
 * by half a band, so their centred labels always fit and are left centred. */
function WrappingXAxisTick({
  x,
  y,
  payload,
  formatter,
  width,
  visibleTicksCount,
  index,
  pointScale = false,
}: Readonly<{
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  formatter: (value: unknown) => string;
  width?: number;
  visibleTicksCount?: number;
  index?: number;
  pointScale?: boolean;
}>) {
  const label = formatter(payload?.value);
  const band = width && visibleTicksCount ? width / visibleTicksCount : X_AXIS_TICK_MAX_WIDTH;
  const tickWidth = Math.min(X_AXIS_TICK_MAX_WIDTH, Math.max(X_AXIS_TICK_MIN_WIDTH, band - AXIS_LABEL_GAP));
  const tickX = x ?? 0;

  const isFirst = pointScale && index === 0;
  const isLast = pointScale && index === (visibleTicksCount ?? 0) - 1;

  // An edge label is anchored on the plot boundary while its neighbour stays centred one `spacing`
  // away, so a full-width edge box overruns that neighbour from ~5 point-scale categories up. Cap the
  // edge box at the room up to the neighbour's near edge (`spacing - tickWidth / 2`); centred ticks
  // are already spaced a full band apart and keep `tickWidth`.
  const spacing =
    width && visibleTicksCount && visibleTicksCount > 1 ? width / (visibleTicksCount - 1) : Infinity;
  const edgeWidth = Math.max(X_AXIS_TICK_MIN_WIDTH, Math.min(tickWidth, spacing - tickWidth / 2));

  let boxX = tickX - tickWidth / 2;
  let boxWidth = tickWidth;
  let textAlign = "text-center";
  if (isFirst) {
    boxX = tickX; // left edge at the point; label extends inward (right)
    boxWidth = edgeWidth;
    textAlign = "text-left";
  } else if (isLast) {
    boxX = tickX - edgeWidth; // right edge at the point; label extends inward (left)
    boxWidth = edgeWidth;
    textAlign = "text-right";
  }

  return (
    <foreignObject
      x={boxX}
      y={(y ?? 0) + X_AXIS_LABEL_TOP_OFFSET}
      width={boxWidth}
      height={AXIS_LABEL_BOX_HEIGHT}
      // Keep the label hit-testable so the `title` full-text tooltip works on hover. The tick sits
      // in the axis band below the plot, so this doesn't intercept hover over the bars/points.
      style={{ overflow: "visible" }}>
      <div
        title={label}
        className={`text-muted-foreground line-clamp-3 ${textAlign} text-xs leading-tight`}
        // Inline, so the clamp tracks the shared line budget the box above is sized from. The class
        // alone would keep clamping at 3 if AXIS_LABEL_MAX_LINES were raised, leaving a taller box
        // with the same three lines in it.
        style={{ textWrap: "pretty", WebkitLineClamp: AXIS_LABEL_MAX_LINES }}>
        {label}
      </div>
    </foreignObject>
  );
}

/** Category tick for a flipped (horizontal) chart. Same `foreignObject` wrapping trick as
 * `WrappingXAxisTick`, but the box hangs to the left of the axis line and is centred on its
 * category band, since here the labels stack down the y-axis.
 *
 * The box height is clamped to the band the same way `WrappingXAxisTick` clamps its width: a fixed
 * three-line box overlaps its neighbours as soon as the band falls below it, so the label sheds
 * lines instead — down to a single line, with the full text still on hover. That clamp is the
 * backstop, not the plan: the chart reserves `CATEGORY_BAND_MIN_HEIGHT` per category (see
 * `getFlippedChartMinHeight`) and scrolls, so in practice every band clears the full line budget
 * however many categories are plotted. */
function WrappingYAxisTick({
  x,
  y,
  payload,
  formatter,
  axisWidth,
  height,
  visibleTicksCount,
}: Readonly<{
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  formatter: (value: unknown) => string;
  /** Gutter the axis reserved, so the label box matches it instead of a fixed maximum. */
  axisWidth: number;
  height?: number;
  visibleTicksCount?: number;
}>) {
  const label = formatter(payload?.value);
  const boxWidth = Math.max(1, axisWidth - AXIS_LABEL_GAP);

  const band = height && visibleTicksCount ? height / visibleTicksCount : undefined;
  const boxHeight = getCategoryLabelBoxHeight(band);
  const lineClamp = getCategoryLabelLineClamp(band);

  return (
    <foreignObject
      x={(x ?? 0) - boxWidth - AXIS_LABEL_GAP}
      y={(y ?? 0) - boxHeight / 2}
      width={boxWidth}
      height={boxHeight}
      style={{ overflow: "visible" }}>
      <div
        title={label}
        className="text-muted-foreground flex h-full items-center justify-end text-xs leading-tight"
        style={{ textWrap: "pretty" }}>
        <span className="line-clamp-3 text-right" style={{ WebkitLineClamp: lineClamp }}>
          {label}
        </span>
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
  pointScale = false,
  horizontal = false,
}: Readonly<CartesianChartProps>) {
  const yScale = yAxisScale ?? computeYAxis(data, dataKeys, zeroBaseline);
  const tickFormatter = xAxisTickFormatter ?? formatXAxisTick;
  const categoryAxisWidth = useMemo(() => {
    if (!horizontal || !hasCategoryAxis) return 0;
    return getCategoryAxisWidth(data.map((row) => tickFormatter(row[xAxisKey])));
  }, [horizontal, hasCategoryAxis, data, xAxisKey, tickFormatter]);

  // Flipped, a bar's value label sits past its end with nothing reserving room for it, so the
  // longest bar loses its label whenever the data max lands on the axis bound. The vertical axis
  // solves the same problem with `padding.top`; this is that padding, sized to the widest label.
  const valueLabelPadding = useMemo(() => {
    if (!horizontal) return 0;
    const labels = data.flatMap((row) => dataKeys.map((key) => formatCellValue(row[key])));
    return getValueLabelPadding(labels);
  }, [horizontal, data, dataKeys]);

  // Flipped, the categories are rows, so the plot has to be tall enough for each of them to keep the
  // full label line budget. The container never grows with the row count on its own, so claim a
  // floor per band and let the chart scroll past it — otherwise a dense chart quietly truncates
  // every label to one line while a sparse one wraps over three (ENG-3148).
  const minChartHeight = useMemo(() => {
    if (!horizontal || !hasCategoryAxis) return 0;
    return getFlippedChartMinHeight(data.length, showLegend ? CHART_LEGEND_HEIGHT : 0);
  }, [horizontal, hasCategoryAxis, data.length, showLegend]);

  const scrolls = minChartHeight > 0;

  return (
    // Scrolling turns the wrapper into a flex column so the chart is a flex item whose height flex
    // layout resolves — fill the container, but never below `minChartHeight` — which keeps the
    // percentage height ResponsiveContainer measures definite. A percentage child of an `h-full` box
    // stretched only by its own `min-height` is the case browsers disagree on.
    <div className={cn("h-full min-h-64 w-full", scrolls && "flex flex-col overflow-y-auto")}>
      <ChartContainer
        config={chartConfig}
        className={cn("w-full", scrolls ? "flex-1" : "h-full")}
        style={scrolls ? { minHeight: minChartHeight } : undefined}>
        <Chart data={data} {...(horizontal ? { layout: "vertical" as const } : {})} {...chartProps}>
          {/* syncWithTicks: draw a gridline only at each tick. Without it Recharts adds
              extra lines at the plot-area top/bottom edges (revealed by the YAxis padding),
              which showed up as unlabelled boundary lines above 80 and below 0. The gridlines
              always run across the value axis, which flips with the layout. */}
          <CartesianGrid strokeDasharray="2 4" vertical={horizontal} horizontal={!horizontal} syncWithTicks />
          {/* Flipped charts swap the axis roles: values run along the x-axis and the categories
              stack down the y-axis. */}
          {horizontal ? (
            <XAxis
              type="number"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              padding={{ left: 4, right: valueLabelPadding }}
              domain={yScale?.domain}
              ticks={yScale?.ticks}
              interval={0}
            />
          ) : (
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              // Label every data point (default recharts hides overlapping ticks, which dropped
              // long question labels on area/line charts) and wrap each label within a max-width.
              interval={hasCategoryAxis ? 0 : undefined}
              height={hasCategoryAxis ? X_AXIS_RESERVED_HEIGHT : undefined}
              tick={
                hasCategoryAxis ? (
                  <WrappingXAxisTick formatter={tickFormatter} pointScale={pointScale} />
                ) : (
                  false
                )
              }
            />
          )}
          {horizontal ? (
            <YAxis
              type="category"
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              width={categoryAxisWidth}
              interval={0}
              tick={
                hasCategoryAxis ? (
                  <WrappingYAxisTick formatter={tickFormatter} axisWidth={categoryAxisWidth} />
                ) : (
                  false
                )
              }
            />
          ) : (
            <YAxis
              tickLine={false}
              axisLine={false}
              padding={{ top: 16, bottom: 4 }}
              domain={yScale?.domain}
              ticks={yScale?.ticks}
              interval={0}
            />
          )}
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
          {showLegend && (
            <ChartLegend
              content={<ChartLegendContent />}
              verticalAlign="bottom"
              height={CHART_LEGEND_HEIGHT}
            />
          )}
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}
