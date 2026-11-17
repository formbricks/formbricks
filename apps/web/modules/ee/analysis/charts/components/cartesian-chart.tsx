"use client";

import { type ElementType, type ReactElement, type ReactNode, useMemo } from "react";
import { CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  AXIS_LABEL_BOX_HEIGHT,
  AXIS_LABEL_GAP,
  AXIS_LABEL_MAX_LINES,
  AXIS_TICK_GAP,
  ROTATED_LABEL_ANGLE,
  formatCellValue,
  formatXAxisTick,
  getCategoryAxisWidth,
  getCategoryLabelBoxHeight,
  getCategoryLabelLineClamp,
  getLegendHeight,
  getRotatedAxisHeight,
  getValueLabelPadding,
  shouldRotateCategoryLabels,
  truncateLabelToBox,
  truncateRotatedLabel,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  type TTimeAxisTickLayout,
  getTimeAxisTickLabels,
  getTimeAxisTickLayout,
} from "@/modules/ee/analysis/charts/lib/time-axis";
import { type YAxisScale, computeYAxis } from "@/modules/ee/analysis/charts/lib/y-axis-scale";
import type { TimeGranularity } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@/modules/ui/components/chart";
import { PolishedChartTooltip } from "./polished-tooltip";

// slate-400: one step darker than the dashed grid, so zero stands out without competing with the series.
const ZERO_LINE_COLOR = "#94a3b8";

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
  /** Response base column on each row; the tooltip prints it as "n = …" for the hovered point. */
  responseBaseKey?: string;
  /** True for point-scale charts (line/area) where the first/last categories sit on the plot
   * boundary. Anchors the edge x-axis labels inward so they aren't clipped by the plot edge.
   * Leave false for band-scale charts (bars), whose edge categories are already inset. */
  pointScale?: boolean;
  /** Flips the chart onto its side: categories run down the y-axis and values across the x-axis.
   * Bar charts only — the category labels move into a gutter on the left, sized to the labels
   * present and the chart's width (see `getCategoryAxisWidth`), wrapped inside it, and cut from the
   * middle to whatever lines the row density leaves (see `truncateLabelToBox`). */
  horizontal?: boolean;
  /** Set when the category axis is a time dimension bucketed by this granularity. Its ticks then
   * thin out to a readable density and use compact, granularity-aware labels (see
   * `getTimeAxisTickLabels`) instead of labelling every bucket with its full date. */
  timeAxis?: { granularity: TimeGranularity; locale: string };
  /** Formats value-axis ticks (and sizes the flipped value-label gutter) in the measure's format. */
  valueAxisTickFormatter?: (value: unknown) => string;
  /** Formats bar value labels; used here only to size the flipped value-label gutter. */
  valueLabelFormatter?: (dataKey: string, value: unknown) => string;
  /** Forwarded to the tooltip: labels for synthetic series keys and a per-measure value format. */
  seriesLabels?: Record<string, string>;
  tooltipValueFormatter?: (
    dataKey: string,
    value: unknown,
    row: Record<string, unknown> | undefined
  ) => string;
}

/** Resolves, for the axis width Recharts measured, which buckets get a label and what each reads. */
type TTimeAxisLabels = (axisWidth: number) => { layout: TTimeAxisTickLayout; labels: (string | null)[] };

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

/** Height a vertical chart's x-axis reserves: none without categories, the diagonal of the rotated
 * labels on a crowded axis, else the wrapped label box. */
const getXAxisHeight = (
  hasCategoryAxis: boolean,
  rotated: boolean,
  rotatedHeight: number
): number | undefined => {
  if (!hasCategoryAxis) return undefined;
  return rotated ? rotatedHeight : X_AXIS_RESERVED_HEIGHT;
};
/** Recharts' default chart margin, kept on the sides a rotated axis does not change. */
const CHART_MARGIN = { top: 5, right: 5, bottom: 5, left: 5 };
/** Width (px) Recharts gives the value axis by default; a rotated label may overhang it. */
const VALUE_AXIS_DEFAULT_WIDTH = 60;

/** Left margin (px) that keeps the first rotated labels inside the SVG: whatever of the label's
 * horizontal run (equal to its vertical one at 45°) the value axis does not already cover. */
const getRotatedLabelLeftMargin = (rotatedAxisHeight: number): number =>
  Math.max(CHART_MARGIN.left, rotatedAxisHeight - VALUE_AXIS_DEFAULT_WIDTH);

/** Vertical offset (px) of the label box below the axis line. */
const X_AXIS_LABEL_TOP_OFFSET = 4;

/** The wrapping label box one x-axis tick draws, positioned by its caller. */
function XAxisTickLabel({
  label,
  x,
  y,
  width,
  textAlign,
}: Readonly<{ label: string; x: number; y?: number; width: number; textAlign: string }>) {
  return (
    <foreignObject
      x={x}
      y={(y ?? 0) + X_AXIS_LABEL_TOP_OFFSET}
      width={width}
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

/** Where one category label's box sits on the x-axis.
 *
 * `pointScale` charts (line/area) place the first and last categories *on* the plot boundary, so a
 * centred label there would spill half its width past the SVG edge and get clipped. For those edge
 * ticks we anchor the box inward (left-align the first, right-align the last) instead of centring,
 * which keeps the full label inside the plot. Band-scale charts (bars) inset their edge categories
 * by half a band, so their centred labels always fit and are left centred. */
function getCategoryTickBox({
  tickX,
  width,
  visibleTicksCount,
  index,
  pointScale,
}: {
  tickX: number;
  width?: number;
  visibleTicksCount?: number;
  index?: number;
  pointScale: boolean;
}): { boxX: number; boxWidth: number; textAlign: string } {
  const band = width && visibleTicksCount ? width / visibleTicksCount : X_AXIS_TICK_MAX_WIDTH;
  const tickWidth = Math.min(X_AXIS_TICK_MAX_WIDTH, Math.max(X_AXIS_TICK_MIN_WIDTH, band - AXIS_LABEL_GAP));

  const isFirst = pointScale && index === 0;
  const isLast = pointScale && index === (visibleTicksCount ?? 0) - 1;

  // An edge label is anchored on the plot boundary while its neighbour stays centred one `spacing`
  // away, so a full-width edge box overruns that neighbour from ~5 point-scale categories up. Cap the
  // edge box at the room up to the neighbour's near edge (`spacing - tickWidth / 2`); centred ticks
  // are already spaced a full band apart and keep `tickWidth`.
  const spacing =
    width && visibleTicksCount && visibleTicksCount > 1 ? width / (visibleTicksCount - 1) : Infinity;
  const edgeWidth = Math.max(X_AXIS_TICK_MIN_WIDTH, Math.min(tickWidth, spacing - tickWidth / 2));

  if (isFirst) {
    // Left edge at the point; the label extends inward (right).
    return { boxX: tickX, boxWidth: edgeWidth, textAlign: "text-left" };
  }
  if (isLast) {
    // Right edge at the point; the label extends inward (left).
    return { boxX: tickX - edgeWidth, boxWidth: edgeWidth, textAlign: "text-right" };
  }
  return { boxX: tickX - tickWidth / 2, boxWidth: tickWidth, textAlign: "text-center" };
}

/** Recharts renders default ticks as SVG `<text>`, which cannot wrap. This custom tick uses a
 * `foreignObject` so long labels (e.g. full survey questions) wrap within a max-width, stay under
 * their data point, and clamp to 3 lines with the full text on hover. The width is derived from the
 * per-category band (`width / visibleTicksCount`, both injected by Recharts' CartesianAxis) so
 * labels shrink to fit as categories are added instead of overlapping each other; edge ticks are
 * placed by `getCategoryTickBox`.
 *
 * A time axis labels one bucket in every `step`, centred with `step` buckets of room, and keeps its
 * labels clear of the plot edges itself (see `getTimeAxisTickLayout`). Unthinned, its labels are
 * placed like any other category. */
function WrappingXAxisTick({
  x,
  y,
  payload,
  formatter,
  width,
  visibleTicksCount,
  index,
  pointScale = false,
  timeAxisLabels,
}: Readonly<{
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  formatter: (value: unknown) => string;
  width?: number;
  visibleTicksCount?: number;
  index?: number;
  pointScale?: boolean;
  timeAxisLabels?: TTimeAxisLabels;
}>) {
  const tickX = x ?? 0;
  const timeAxis = timeAxisLabels && width && index != null ? timeAxisLabels(width) : undefined;
  const label = timeAxis && index != null ? timeAxis.labels[index] : formatter(payload?.value);
  if (label == null) return null;

  if (timeAxis && timeAxis.layout.step > 1) {
    const slotBoxWidth = Math.max(
      1,
      Math.min(X_AXIS_TICK_MAX_WIDTH, timeAxis.layout.slotWidth - AXIS_LABEL_GAP)
    );
    return (
      <XAxisTickLabel
        label={label}
        x={tickX - slotBoxWidth / 2}
        y={y}
        width={slotBoxWidth}
        textAlign="text-center"
      />
    );
  }

  const { boxX, boxWidth, textAlign } = getCategoryTickBox({
    tickX,
    width,
    visibleTicksCount,
    index,
    pointScale,
  });
  return <XAxisTickLabel label={label} x={boxX} y={y} width={boxWidth} textAlign={textAlign} />;
}

/** Category tick for a flipped (horizontal) chart. Same `foreignObject` wrapping trick as
 * `WrappingXAxisTick`, but the box hangs to the left of the axis line and is centred on its
 * category band, since here the labels stack down the y-axis.
 *
 * The box height is clamped to the band the same way `WrappingXAxisTick` clamps its width: a fixed
 * three-line box overlaps its neighbours as soon as the band falls below it, so the label sheds
 * lines instead — down to a single line, with the full text still on hover.
 *
 * Whatever lines that leaves, the label is cut to fit them from the middle rather than the end
 * (`truncateLabelToBox`): survey questions in one source share their opening words, so a
 * tail-truncated dense axis printed the same "CSAT with clarity of…" against every bar (ENG-3148).
 * The chart keeps its container's height — the reader sees every row at once, and the label adapts
 * to the room the density leaves. */
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
  // The box hangs left of the tick, ending `AXIS_TICK_GAP` short of the axis line. Recharts does not
  // always leave the whole gutter to the left of that tick — a few pixels go to the chart margin —
  // so a box sized to the gutter starts at a negative x and the SVG clips the first glyph off the
  // longest label. Anchor the right edge and let the left edge stop at the viewport.
  const boxWidth = Math.max(1, axisWidth - AXIS_LABEL_GAP);
  // Recharts does not always leave the whole gutter left of the tick, so an unguarded box starts at
  // a negative x and the SVG clips the first glyph off the longest label.
  const boxLeft = Math.max(0, (x ?? 0) - boxWidth - AXIS_TICK_GAP);

  const band = height && visibleTicksCount ? height / visibleTicksCount : undefined;
  const boxHeight = getCategoryLabelBoxHeight(band);
  const lineClamp = getCategoryLabelLineClamp();
  const shownLabel = truncateLabelToBox(label, boxWidth, lineClamp);

  return (
    <foreignObject
      x={boxLeft}
      y={(y ?? 0) - boxHeight / 2}
      width={boxWidth}
      height={boxHeight}
      style={{ overflow: "visible" }}>
      <div
        title={label}
        className="text-muted-foreground flex h-full items-center justify-end text-xs leading-tight"
        style={{ textWrap: "pretty" }}>
        <span className="line-clamp-3 text-right" style={{ WebkitLineClamp: lineClamp }}>
          {shownLabel}
        </span>
      </div>
    </foreignObject>
  );
}

/** A category axis label rotated −45°, for an axis too crowded for the wrapping box: one line, cut
 * from the middle to {@link ROTATED_LABEL_MAX_CHARS}, with the full text on hover. */
function RotatedXAxisTick({
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
  if (!label) return null;
  const shown = truncateRotatedLabel(label);
  return (
    <g transform={`translate(${x ?? 0},${(y ?? 0) + X_AXIS_LABEL_TOP_OFFSET})`}>
      <text
        x={0}
        y={0}
        dy={8}
        textAnchor="end"
        transform={`rotate(${-ROTATED_LABEL_ANGLE})`}
        className="fill-muted-foreground"
        fontSize={12}>
        <title>{label}</title>
        {shown}
      </text>
    </g>
  );
}

/** The vertical chart's x-axis tick: none without categories, a rotated label on a crowded axis, else
 * the wrapping label box. */
function renderCategoryTick({
  hasCategoryAxis,
  rotated,
  formatter,
  pointScale,
  timeAxisLabels,
}: {
  hasCategoryAxis: boolean;
  rotated: boolean;
  formatter: (value: unknown) => string;
  pointScale: boolean;
  timeAxisLabels?: TTimeAxisLabels;
}): ReactElement<SVGElement> | false {
  if (!hasCategoryAxis) return false;
  if (rotated) return <RotatedXAxisTick formatter={formatter} />;
  return <WrappingXAxisTick formatter={formatter} pointScale={pointScale} timeAxisLabels={timeAxisLabels} />;
}

/** What a chart's layout needs from the measured container: the size recharts is about to draw at
 * and the category gutter derived from it. */
type TMeasuredLayout = {
  width?: number;
  height?: number;
  categoryAxisWidth: number;
  /** Whether the vertical category axis is too crowded for wrapped labels and rotates them. */
  rotateCategoryLabels: boolean;
  /** Height (px) the legend reserves: one row per line its entries wrap onto. */
  legendHeight: number;
};

/**
 * Sizes the flipped category gutter from the width the chart is laid out with, in the same render.
 *
 * Rendered as the `ResponsiveContainer`'s child, so recharts hands it the container's measured
 * `width`/`height` (it clones its child with them) *before* the chart element exists. That is what
 * lets the gutter scale with the chart (ENG-3223): a width observed from outside arrived after
 * recharts had computed its plot offset, so `<YAxis width>` changed but the offset did not, and the
 * labels painted under the bars. Here the tick boxes, the axis width and the offset all come from
 * one `width` — on the first render and on every resize, which recharts treats as a fresh layout.
 *
 * Before the container has measured (server render, first client pass) `width` is unset and the
 * gutter falls back to its flat ceiling; the container renders nothing until it has a size anyway.
 */
function MeasuredChart({
  width,
  height,
  categoryLabels,
  verticalCategoryCount,
  legendLabels,
  children,
}: Readonly<{
  width?: number;
  height?: number;
  /** Formatted category labels of a flipped chart; empty when there is no category gutter. */
  categoryLabels: string[];
  /** Categories on a vertical (non-time) category axis; 0 when the axis wraps or thins on its own. */
  verticalCategoryCount: number;
  /** Legend entries, to size the legend to the rows they wrap onto. */
  legendLabels: string[];
  children: (layout: TMeasuredLayout) => ReactElement;
}>) {
  const categoryAxisWidth = categoryLabels.length > 0 ? getCategoryAxisWidth(categoryLabels, width) : 0;
  const rotateCategoryLabels = shouldRotateCategoryLabels(verticalCategoryCount, width);
  const legendHeight = getLegendHeight(legendLabels, width, height);
  return children({ width, height, categoryAxisWidth, rotateCategoryLabels, legendHeight });
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
  responseBaseKey,
  pointScale = false,
  horizontal = false,
  timeAxis,
  valueAxisTickFormatter,
  valueLabelFormatter,
  seriesLabels,
  tooltipValueFormatter,
}: Readonly<CartesianChartProps>) {
  const yScale = yAxisScale ?? computeYAxis(data, dataKeys, zeroBaseline);
  const tickFormatter = xAxisTickFormatter ?? formatXAxisTick;

  // Every tick of one render sees the same axis width, so they share one layout and label list.
  const timeGranularity = timeAxis?.granularity;
  const timeLocale = timeAxis?.locale;
  const timeAxisLabels = useMemo<TTimeAxisLabels | undefined>(() => {
    if (!timeGranularity || !timeLocale || horizontal || !hasCategoryAxis) return undefined;
    const values = data.map((row) => row[xAxisKey]);
    const byWidth = new Map<number, ReturnType<TTimeAxisLabels>>();
    return (axisWidth) => {
      let resolved = byWidth.get(axisWidth);
      if (!resolved) {
        const layout = getTimeAxisTickLayout(values.length, axisWidth, pointScale);
        resolved = { layout, labels: getTimeAxisTickLabels(values, timeGranularity, timeLocale, layout) };
        byWidth.set(axisWidth, resolved);
      }
      return resolved;
    };
  }, [timeGranularity, timeLocale, horizontal, hasCategoryAxis, data, xAxisKey, pointScale]);

  // The gutter itself is sized inside `MeasuredChart`, where the chart's width is known.
  const categoryLabels = useMemo(() => {
    if (!horizontal || !hasCategoryAxis) return [];
    return data.map((row) => tickFormatter(row[xAxisKey]));
  }, [horizontal, hasCategoryAxis, data, xAxisKey, tickFormatter]);

  // Flipped, a bar's value label sits past its end with nothing reserving room for it, so the
  // longest bar loses its label whenever the data max lands on the axis bound. The vertical axis
  // solves the same problem with `padding.top`; this is that padding, sized to the widest label.
  const valueLabelPadding = useMemo(() => {
    if (!horizontal) return 0;
    const labels = data.flatMap((row) =>
      dataKeys.map((key) =>
        valueLabelFormatter ? valueLabelFormatter(key, row[key]) : formatCellValue(row[key])
      )
    );
    return getValueLabelPadding(labels);
  }, [horizontal, data, dataKeys, valueLabelFormatter]);

  // A time axis thins its own ticks; only a plain vertical category axis can need rotating.
  const verticalCategoryCount = !horizontal && hasCategoryAxis && !timeAxisLabels ? data.length : 0;
  const rotatedAxisHeight = useMemo(
    () =>
      verticalCategoryCount > 0 ? getRotatedAxisHeight(data.map((row) => tickFormatter(row[xAxisKey]))) : 0,
    [verticalCategoryCount, data, tickFormatter, xAxisKey]
  );
  const rotatedLeftMargin = getRotatedLabelLeftMargin(rotatedAxisHeight);
  const legendLabels = useMemo(
    () =>
      showLegend
        ? dataKeys.map((key) => {
            const label = chartConfig[key]?.label;
            return typeof label === "string" ? label : key;
          })
        : [],
    [showLegend, dataKeys, chartConfig]
  );

  return (
    // A flipped chart keeps its container's height: every row stays on screen and the labels adapt
    // to the band that leaves (see `WrappingYAxisTick`). Reserving height per row instead would put
    // a scroll region inside a dashboard widget, hiding rows behind an interaction to show label
    // text that a middle-truncated label already distinguishes.
    <div className="h-full min-h-64 w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <MeasuredChart
          categoryLabels={categoryLabels}
          verticalCategoryCount={verticalCategoryCount}
          legendLabels={legendLabels}>
          {({ width, height, categoryAxisWidth, rotateCategoryLabels, legendHeight }) => (
            <Chart
              data={data}
              width={width}
              height={height}
              {...(horizontal ? { layout: "vertical" as const } : {})}
              // A rotated label runs left from its tick; the first ones would leave the SVG.
              {...(rotateCategoryLabels ? { margin: { ...CHART_MARGIN, left: rotatedLeftMargin } } : {})}
              {...chartProps}>
              {/* syncWithTicks: draw a gridline only at each tick. Without it Recharts adds
              extra lines at the plot-area top/bottom edges (revealed by the YAxis padding),
              which showed up as unlabelled boundary lines above 80 and below 0. The gridlines
              always run across the value axis, which flips with the layout. */}
              <CartesianGrid
                strokeDasharray="2 4"
                vertical={horizontal}
                horizontal={!horizontal}
                syncWithTicks
              />
              {/* A scale that runs below zero (NPS -100..100) needs its zero drawn solid: the dashed
              gridline at 0 reads like any other tick, and above/below zero is the point of the chart. */}
              {(yScale?.domain[0] ?? 0) < 0 &&
                (horizontal ? (
                  <ReferenceLine x={0} stroke={ZERO_LINE_COLOR} />
                ) : (
                  <ReferenceLine y={0} stroke={ZERO_LINE_COLOR} />
                ))}
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
                  tickFormatter={valueAxisTickFormatter}
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
                  height={getXAxisHeight(hasCategoryAxis, rotateCategoryLabels, rotatedAxisHeight)}
                  tick={renderCategoryTick({
                    hasCategoryAxis,
                    rotated: rotateCategoryLabels,
                    formatter: tickFormatter,
                    pointScale,
                    timeAxisLabels,
                  })}
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
                  tickFormatter={valueAxisTickFormatter}
                />
              )}
              <ChartTooltip
                content={
                  <PolishedChartTooltip
                    labelFormatter={xAxisTickFormatter}
                    hideLabel={tooltipHideLabel ?? !hasCategoryAxis}
                    responseBaseKey={responseBaseKey}
                    seriesLabels={seriesLabels}
                    valueFormatter={tooltipValueFormatter}
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
                  height={legendHeight}
                  // Entries past the capped height scroll inside the legend instead of covering the plot.
                  wrapperStyle={{ maxHeight: legendHeight, overflowY: "auto" }}
                />
              )}
              {children}
            </Chart>
          )}
        </MeasuredChart>
      </ChartContainer>
    </div>
  );
}
