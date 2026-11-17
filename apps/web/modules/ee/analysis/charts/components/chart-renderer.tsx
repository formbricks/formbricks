"use client";

import type { TFunction } from "i18next";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, Bar, BarChart, Cell, Label, LabelList, Legend, Pie, PieChart } from "recharts";
import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import { cn } from "@/lib/cn";
import { BreakdownBars } from "@/modules/ee/analysis/charts/components/breakdown-bars";
import {
  CartesianChart,
  type CartesianChartProps,
} from "@/modules/ee/analysis/charts/components/cartesian-chart";
import { ChartEmptyState } from "@/modules/ee/analysis/charts/components/chart-empty-state";
import { MatrixChart } from "@/modules/ee/analysis/charts/components/matrix-chart";
import { PolishedChartTooltip } from "@/modules/ee/analysis/charts/components/polished-tooltip";
import { ResponseBaseFooter } from "@/modules/ee/analysis/charts/components/response-base-footer";
import { computeBigNumberValue } from "@/modules/ee/analysis/charts/lib/big-number";
import { resolveChartDisplay } from "@/modules/ee/analysis/charts/lib/chart-display";
import { isChartResultEmpty } from "@/modules/ee/analysis/charts/lib/chart-emptiness";
import {
  applyEmptyValueSetting,
  canStackSeries,
  collapseEmptyGroupRows,
  getChartGrouping,
  getStackedBarRadius,
  stripSharedLabelPrefix,
} from "@/modules/ee/analysis/charts/lib/chart-series";
import {
  CHART_BRAND_DARK,
  CHART_MEASURE_COLORS,
  PIE_MEASURE_NAME_KEY,
  PIE_MEASURE_VALUE_KEY,
  PIVOTED_MEASURE_KEY,
  PIVOTED_VALUE_KEY,
  formatPercentShare,
  getSemanticDimensionColor,
  pivotMeasuresToCategories,
  prepareMeasureSliceData,
  preparePieData,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  formatMeasureAxisTick,
  formatMeasureValue,
  getSharedMeasureFormatId,
} from "@/modules/ee/analysis/charts/lib/measure-format";
import { computeResponseBase } from "@/modules/ee/analysis/charts/lib/response-base";
import {
  buildSeriesModel,
  createGroupValueFormatter,
  getAreaFillOpacity,
  getSeriesValueScales,
  orderMeasureKeys,
} from "@/modules/ee/analysis/charts/lib/series-model";
import { formatTimeBucket, getTimeGranularityFromKey } from "@/modules/ee/analysis/charts/lib/time-axis";
import { type YAxisScale, computeYAxis } from "@/modules/ee/analysis/charts/lib/y-axis-scale";
import {
  type TResponseBaseFamily,
  formatCubeColumnHeader,
  getMeasureAxisLabel,
  getResponseBaseFamily,
  getResponseBaseMeasureId,
  sortMeasureIdsForCategoryAxis,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartTooltip } from "@/modules/ui/components/chart";

interface PieLabelProps {
  readonly cx?: number;
  readonly cy?: number;
  readonly midAngle?: number;
  readonly outerRadius?: number;
  readonly percent?: number;
  readonly value?: number;
}

// Tiny slices hide both label and leader line so adjacent labels don't overlap
// and `minAngle`-stretched slices don't end up with lines pointing at nothing.
const PIE_LABEL_MIN_PERCENT = 0.02;

/** Shown instead of a number when a measure had nothing to compute (an en dash, not a zero). */
const NO_DATA_PLACEHOLDER = "\u2013";

// Curried with the active language: recharts calls the renderer outside React, so the locale has
// to be closed over rather than read from a hook inside it.
const createPieLabelRenderer = (locale: string, formatValue: (value: unknown) => string) =>
  function PieSliceLabel({ cx, cy, midAngle, outerRadius, percent, value }: PieLabelProps) {
    if (cx == null || cy == null || midAngle == null || outerRadius == null || percent == null) return null;
    if (percent < PIE_LABEL_MIN_PERCENT) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 22;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? "start" : "end";
    return (
      <text
        x={x}
        y={y}
        className="fill-muted-foreground"
        fontSize={11}
        textAnchor={textAnchor}
        dominantBaseline="central">
        {formatValue(value)} ({formatPercentShare(percent, locale)})
      </text>
    );
  };

interface PieLabelLineProps {
  percent?: number;
  points?: Array<{ x: number; y: number }>;
}

const renderPieLabelLine = ({ percent, points }: PieLabelLineProps) => {
  if (percent == null || percent < PIE_LABEL_MIN_PERCENT) return null;
  if (!points || points.length < 2) return null;
  return (
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
      fill="none"
      className="stroke-border"
      strokeWidth={1}
    />
  );
};

const PieCenterLabel = ({
  viewBox,
  total,
  label,
}: {
  readonly viewBox?: { cx?: number; cy?: number };
  /** Already formatted for the measure; empty when the slices do not add up to a total. */
  readonly total: string;
  readonly label: string;
}) => {
  const cx = viewBox?.cx;
  const cy = viewBox?.cy;
  if (cx == null || cy == null || !total) return null;
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={26}
        fontWeight={600}
        style={{ fontVariantNumeric: "tabular-nums" }}>
        {total}
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground"
        fontSize={11}>
        {label}
      </text>
    </g>
  );
};

/** Formats a value by the measure behind its data key, in the app's locale. */
type TValueFormatter = (dataKey: string, value: unknown) => string;

interface BarChartViewProps extends Pick<
  CartesianChartProps,
  "timeAxis" | "responseBaseKey" | "seriesLabels" | "tooltipValueFormatter" | "valueAxisTickFormatter"
> {
  sortedData: TChartDataRow[];
  dataKeys: string[];
  isMultiMeasure: boolean;
  hasCategoryAxis: boolean;
  xAxisKey: string;
  chartConfig: ChartConfig;
  formatDimensionValue: (value: unknown) => string;
  isHorizontal?: boolean;
  /** Stack several series into one bar per category instead of placing them side by side. */
  isStacked?: boolean;
  /** Precomputed value axis, for stacked bars whose axis has to fit the stack's total. */
  yAxisScale?: YAxisScale;
  formatValue: TValueFormatter;
  /** Short labels for a measure-only chart's bars, keyed by measure id (shared prefix dropped). */
  measureAxisLabels?: Record<string, string>;
  locale: string;
}

const BarChartView = ({
  sortedData,
  dataKeys,
  isMultiMeasure,
  hasCategoryAxis,
  xAxisKey,
  chartConfig,
  formatDimensionValue,
  isHorizontal = false,
  isStacked = false,
  yAxisScale,
  timeAxis,
  responseBaseKey,
  seriesLabels,
  tooltipValueFormatter,
  valueAxisTickFormatter,
  formatValue,
  measureAxisLabels,
  locale,
}: Readonly<BarChartViewProps>) => {
  const { t } = useTranslation();
  // Value labels sit past the end of the bar, which is the top of a vertical bar and the
  // right-hand end of a horizontal one.
  const valueLabelPosition = isHorizontal ? "right" : "top";

  // Measure-only queries (no dimension or time grouping) return a single row with one
  // column per measure. Rendered as N bar series that row forms a single category band
  // that recharts centers in the plot, leaving a wide empty gap before the first bar
  // (ENG-1796). Pivot the measures into categories so the bars fill the axis from the
  // left like any other category bar chart, labelled by measure on the x-axis.
  if (!hasCategoryAxis) {
    // Sentiment measures pivot into the scale order the sentiment *dimension* axis uses,
    // so this chart and a dimension-grouped one read in the same direction.
    const axisKeys = sortMeasureIdsForCategoryAxis(dataKeys);
    const labelFor = (key: string) => measureAxisLabels?.[key] ?? formatCubeColumnHeader(key, t);
    const measureData = pivotMeasuresToCategories(sortedData, axisKeys, labelFor, responseBaseKey);
    // Pivoting collapses every measure onto PIVOTED_VALUE_KEY ("value"), which carries no measure
    // id, so an axis derived from the pivoted rows can't look up fixed-scale candidates and falls
    // back to data-driven "nice" bounds. Resolve the scale from the original measure columns so
    // rating/CSAT/CES/NPS averages still pin to the question scale, e.g. 3.3 on a 1-5 rating tops
    // the axis at 5, not 4 (ENG-2226).
    const pivotedScale = computeYAxis(sortedData, dataKeys, true);
    const sharedFormatMeasure = getSharedMeasureFormatId(axisKeys);
    return (
      <CartesianChart
        chart={BarChart}
        data={measureData}
        xAxisKey={PIVOTED_MEASURE_KEY}
        dataKeys={[PIVOTED_VALUE_KEY]}
        yAxisScale={pivotedScale}
        chartConfig={chartConfig}
        tooltipCursor={false}
        zeroBaseline
        tooltipHideLabel
        horizontal={isHorizontal}
        xAxisTickFormatter={(value: unknown) => labelFor(typeof value === "string" ? value : "")}
        valueAxisTickFormatter={(value: unknown) => formatMeasureAxisTick(sharedFormatMeasure, value, locale)}
        // Only sizes the flipped value-label gutter, so the shared format is close enough.
        valueLabelFormatter={(_key, value) => formatValue(sharedFormatMeasure ?? "", value)}
        tooltipValueFormatter={(_key, value, row) =>
          formatValue(typeof row?.[PIVOTED_MEASURE_KEY] === "string" ? row[PIVOTED_MEASURE_KEY] : "", value)
        }
        responseBaseKey={responseBaseKey}>
        <Bar dataKey={PIVOTED_VALUE_KEY} fill={CHART_BRAND_DARK} radius={4}>
          <LabelList
            position={valueLabelPosition}
            className="fill-foreground"
            fontSize={11}
            // No dataKey: with one set recharts ignores valueAccessor. Reading the row instead lets each
            // bar be formatted by its own measure.
            valueAccessor={(entry: { payload?: TChartDataRow }) =>
              formatValue(
                String(entry.payload?.[PIVOTED_MEASURE_KEY] ?? ""),
                entry.payload?.[PIVOTED_VALUE_KEY]
              )
            }
          />
        </Bar>
      </CartesianChart>
    );
  }

  // Setting `fill` on the data row (not via <Cell>) is what propagates
  // the per-bar colour into the tooltip payload as well as the SVG.
  const barData = isMultiMeasure
    ? sortedData
    : sortedData.map((row, index) => ({
        ...row,
        fill:
          getSemanticDimensionColor(xAxisKey, row[xAxisKey]) ??
          CHART_MEASURE_COLORS[index % CHART_MEASURE_COLORS.length],
      }));

  return (
    <CartesianChart
      chart={BarChart}
      data={barData}
      xAxisKey={xAxisKey}
      dataKeys={dataKeys}
      chartConfig={chartConfig}
      showLegend={isMultiMeasure}
      tooltipCursor={false}
      zeroBaseline
      hasCategoryAxis={hasCategoryAxis}
      horizontal={isHorizontal}
      xAxisTickFormatter={formatDimensionValue}
      timeAxis={timeAxis}
      responseBaseKey={responseBaseKey}
      yAxisScale={yAxisScale}
      seriesLabels={seriesLabels}
      tooltipValueFormatter={tooltipValueFormatter}
      valueAxisTickFormatter={valueAxisTickFormatter}
      valueLabelFormatter={formatValue}
      chartProps={isMultiMeasure ? { barCategoryGap: "20%" } : {}}>
      {dataKeys.map((key, index) => (
        <Bar
          key={key}
          dataKey={key}
          fill={chartConfig[key]?.color}
          // A stack rounds only its outer end, so the segments read as one bar.
          radius={isStacked ? getStackedBarRadius(index === dataKeys.length - 1, isHorizontal) : 4}
          {...(isStacked ? { stackId: "stack" } : {})}>
          {!isMultiMeasure && (
            <LabelList
              dataKey={key}
              position={valueLabelPosition}
              className="fill-foreground"
              fontSize={11}
              formatter={(value: unknown) => formatValue(key, value)}
            />
          )}
        </Bar>
      ))}
    </CartesianChart>
  );
};

interface PieChartViewProps {
  sortedData: TChartDataRow[];
  dataKeys: string[];
  dataKey: string;
  isMultiMeasure: boolean;
  query: TChartQuery;
  timeDimKey: string | undefined;
  xAxisKey: string;
  chartConfig: ChartConfig;
  formatDimensionValue: (value: unknown) => string;
  responseBaseKey?: string;
  formatValue: TValueFormatter;
  measureLabels: Record<string, string>;
}

const PieChartView = ({
  sortedData,
  dataKeys,
  dataKey,
  isMultiMeasure,
  query,
  timeDimKey,
  xAxisKey,
  chartConfig,
  formatDimensionValue,
  responseBaseKey,
  formatValue,
  measureLabels,
}: Readonly<PieChartViewProps>) => {
  const { t, i18n } = useTranslation();

  // With several measures and no dimension (e.g. the six Emotion counts), each row column is a
  // measure, not a slice — pivot the measures into one slice per measure so the pie shows them
  // all instead of only the first. A dimension-based pie keeps its existing (rows = slices) shape.
  const useMeasureSlices = isMultiMeasure && (query.dimensions?.length ?? 0) === 0 && !timeDimKey;
  const pieDataKey = useMeasureSlices ? PIE_MEASURE_VALUE_KEY : dataKey;
  const pieNameKey = useMeasureSlices ? PIE_MEASURE_NAME_KEY : xAxisKey;
  const pieSource = useMeasureSlices
    ? prepareMeasureSliceData(
        sortedData,
        dataKeys,
        (key) => measureLabels[key] ?? formatCubeColumnHeader(key, t),
        responseBaseKey
      )
    : sortedData;
  // Slices of several measures are summed counts; a dimension pie shows its one measure.
  // Every slice and the centre share one format: the slices' common measure format, or the plain
  // default when the measures disagree (a CSAT percent beside a count) rather than the first one's.
  const sliceMeasures = useMeasureSlices ? dataKeys : [dataKey];
  const sliceFormatMeasure = getSharedMeasureFormatId(sliceMeasures) ?? "";
  const formatSliceValue = (value: unknown) => formatValue(sliceFormatMeasure, value);
  // A total only means something for counts; adding up scores or averages does not.
  const showsTotal = canStackSeries(sliceMeasures);
  const renderPieLabel = createPieLabelRenderer(i18n.language, formatSliceValue);
  const pieResult = preparePieData(pieSource, pieDataKey, pieNameKey);
  // Every slice is zero: there is no whole to take a share of.
  if (!pieResult) {
    return <ChartEmptyState message={t("workspace.analysis.charts.no_data_available")} />;
  }
  const { processedData, colors } = pieResult;
  const total = processedData.reduce((sum, row) => sum + (Number(row[pieDataKey]) || 0), 0);
  // Multi-measure pies have no single measure to name the center; show just the total.
  const centerLabel = useMeasureSlices ? "" : (measureLabels[dataKey] ?? formatCubeColumnHeader(dataKey, t));

  return (
    <div className="h-full min-h-64 w-full min-w-0">
      <ChartContainer config={chartConfig} className="h-full w-full min-w-0">
        <PieChart margin={{ top: 16, right: 32, bottom: 8, left: 32 }}>
          <Pie
            data={processedData}
            dataKey={pieDataKey}
            nameKey={pieNameKey}
            cx="50%"
            cy="45%"
            innerRadius="55%"
            outerRadius="75%"
            paddingAngle={2}
            minAngle={2}
            // Recharts types `labelLine` as `ReactElement | function -> ReactElement`,
            // but returning `null` from the function is supported at runtime and is
            // how we hide the leader line for sub-2% slices.
            labelLine={renderPieLabelLine as never}
            label={renderPieLabel}>
            {processedData.map((row, index) => {
              const rowKey = row[pieNameKey] ?? `row-${index}`;
              const uniqueKey = `${pieNameKey}-${String(rowKey)}-${index}`;
              return <Cell key={uniqueKey} fill={colors[index] || CHART_BRAND_DARK} />;
            })}
            <Label
              position="center"
              content={
                <PieCenterLabel total={showsTotal ? formatSliceValue(total) : ""} label={centerLabel} />
              }
            />
          </Pie>
          {/* Measure slices carry the measure label on the row itself, so the header (the same
              slice name) would only repeat it — suppress it like the pivoted bar chart does. */}
          <ChartTooltip
            content={
              <PolishedChartTooltip
                labelFormatter={formatDimensionValue}
                hideLabel={useMeasureSlices}
                responseBaseKey={responseBaseKey}
                valueFormatter={(_key, value) => formatSliceValue(value)}
              />
            }
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value: string) => formatDimensionValue(value)}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
};

interface ChartRendererProps {
  chartType: TChartType;
  data: TChartDataRow[];
  query: TChartQuery;
  /** value_id → default-language label map, present when the query groups by valueId. */
  optionLabels?: Record<string, string>;
  /** Matrix row field_id → statement map, present when the query groups by fieldId. */
  fieldLabels?: Record<string, string>;
  /** Embedded-data member → key name map, so a legend names the key rather than the member. */
  memberLabels?: Record<string, string>;
  /** Saved display settings. Charts saved before these existed have an empty config and keep
   * the previous behavior (vertical bars). */
  config?: TChartConfig;
}

type TResponseBase = { key: string; family: TResponseBaseFamily; count: number };

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

/** Line is a display style of the area type, not a type of its own: both render the same Recharts
 * area series over the same axes and differ only in how the band under the stroke is painted. */
function AreaChartView({
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
          {dataKeys.map((key) => {
            const color = chartConfig[key]?.color;
            return (
              <linearGradient key={key} id={`${gradientIdPrefix}-line-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
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

/**
 * A single measure value. A measure with nothing to compute comes back as NULL (see
 * restoreNullMeasures in cube-client, which maps the pivot's sentinel back to null); printing it as 0
 * would be a confident "0" for "never asked", so it shows a no-data glyph instead. The value is
 * formatted by its measure — NPS whole, CSAT percent, averages one decimal, counts grouped — the same
 * as the measure's bar labels and tooltips.
 */
function BigNumberView({
  value,
  formatted,
  label,
}: Readonly<{ value: number | null; formatted: string; label: string }>) {
  const hasValue = value !== null;
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-center">
        <div
          className={cn(
            "text-5xl font-semibold tracking-tight tabular-nums",
            hasValue ? "text-foreground" : "text-muted-foreground"
          )}>
          {hasValue ? formatted : NO_DATA_PLACEHOLDER}
        </div>
        <div className="text-muted-foreground mt-2 text-sm">{label}</div>
      </div>
    </div>
  );
}

/** Every chart type drawn along a single category or time axis: area, bar, pie and big number. */
function SeriesChartRenderer({
  chartType,
  data,
  query,
  optionLabels,
  memberLabels,
  config,
}: Readonly<Omit<ChartRendererProps, "fieldLabels">>) {
  // Empty groups go before anything is counted, so the response base matches the bars on screen.
  const { showEmptyValues } = resolveChartDisplay(config);
  const { dimensionKeys } = getChartGrouping(query);
  const rows = collapseEmptyGroupRows(
    applyEmptyValueSetting(data ?? [], dimensionKeys, showEmptyValues),
    dimensionKeys,
    query.measures ?? []
  );
  const responseBase = resolveResponseBase(query, rows);
  const chart = (
    <SeriesChart
      chartType={chartType}
      data={rows}
      query={query}
      optionLabels={optionLabels}
      memberLabels={memberLabels}
      config={config}
      responseBase={responseBase}
    />
  );
  // A chart with nothing to show has no base. Every type that has one prints it in the same place.
  if (!responseBase) return chart;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{chart}</div>
      <ResponseBaseFooter family={responseBase.family} count={responseBase.count} />
    </div>
  );
}

/**
 * The answers every measure on the chart is computed from, when they share one base count and the
 * rows carry it (the server adds it to the query; see withResponseBaseMeasure).
 */
const resolveResponseBase = (query: TChartQuery, data: TChartDataRow[]): TResponseBase | undefined => {
  const key = getResponseBaseMeasureId(query.measures ?? []);
  const family = key ? getResponseBaseFamily(key) : undefined;
  if (!key || !family) return undefined;
  const count = computeResponseBase(data ?? [], key);
  return count === null ? undefined : { key, family, count };
};

function SeriesChart({
  chartType,
  data,
  query,
  optionLabels,
  memberLabels,
  config,
  responseBase,
}: Readonly<Omit<ChartRendererProps, "fieldLabels"> & { responseBase?: TResponseBase }>) {
  const responseBaseKey = responseBase?.key;
  const { t, i18n } = useTranslation();
  const { barOrientation, pieDisplay, areaDisplay, stacked } = resolveChartDisplay(config);
  if (!data || data.length === 0) {
    return <ChartEmptyState message={t("workspace.analysis.charts.no_data_available")} />;
  }

  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const rowKeys = Object.keys(data[0] ?? {});
  const grouping = getChartGrouping(query);
  const timeDimKey = grouping.isTimeCategory ? grouping.categoryKey : undefined;

  const xAxisKey = grouping.categoryKey ?? rowKeys[0] ?? "key";
  // Measure-only charts (e.g. the emotion counts) have no real category: xAxisKey falls back to a
  // measure column, so the single group would otherwise be labelled with that measure's value (a
  // stray "1"). Track that so the x-axis tick and tooltip header are suppressed instead.
  const hasCategoryAxis = Boolean(grouping.categoryKey);

  const formatGroupValue = createGroupValueFormatter(t, optionLabels);

  // A time-bucketed x-axis formats by its granularity: the tooltip header keeps an hourly bucket's
  // time, and the axis thins its ticks to a readable density (ENG-3211).
  const timeGranularity = timeDimKey ? getTimeGranularityFromKey(timeDimKey) : undefined;
  const timeAxis = timeGranularity ? { granularity: timeGranularity, locale } : undefined;
  const formatDimensionValue = (value: unknown): string => {
    if (timeGranularity) return formatTimeBucket(value, timeGranularity, locale);
    return formatGroupValue(xAxisKey, value);
  };

  const measureIds = query.measures?.filter((m) => rowKeys.includes(m)) ?? [];
  const measureKeys = orderMeasureKeys(
    measureIds.length > 0 ? measureIds : rowKeys.filter((k) => k !== xAxisKey),
    grouping.dimensionKeys
  );

  if (measureKeys.length === 0) {
    return <ChartEmptyState message={t("workspace.analysis.charts.no_data_available")} />;
  }

  // Labels for the measures, without a "NPS: " / "Emotion: " family prefix they all share.
  const measureLabelList = stripSharedLabelPrefix(
    measureKeys.map((key) => formatCubeColumnHeader(key, t, memberLabels))
  );
  const measureLabels = Object.fromEntries(measureKeys.map((key, i) => [key, measureLabelList[i]]));

  // A grouping on top of the category axis is drawn as one series per group value instead of one
  // x tick per (category, group) row. Pie and big number fold their rows themselves.
  const isGrouped =
    grouping.groupKeys.length > 0 && hasCategoryAxis && (chartType === "bar" || chartType === "area");

  const {
    rows: chartRows,
    dataKeys,
    seriesMeasure,
    seriesConfig,
  } = buildSeriesModel({
    data,
    grouping,
    xAxisKey,
    hasCategoryAxis,
    isGrouped,
    measureKeys,
    measureLabels,
    optionLabels,
    formatGroupValue,
  });
  const chartConfig: ChartConfig = seriesConfig;

  const seriesLabels = Object.fromEntries(
    Object.entries(chartConfig).map(([key, entry]) => [
      key,
      typeof entry.label === "string" ? entry.label : key,
    ])
  );
  const formatValue: TValueFormatter = (dataKey, value) =>
    formatMeasureValue(seriesMeasure[dataKey] ?? dataKey, value, locale);
  const tooltipValueFormatter = (dataKey: string, value: unknown) => formatValue(dataKey, value);
  const axisMeasure = getSharedMeasureFormatId(measureKeys);
  const valueAxisTickFormatter = (value: unknown) => formatMeasureAxisTick(axisMeasure, value, locale);

  const dataKey = dataKeys[0];
  const isMultiSeries = dataKeys.length > 1;
  const isStacked = stacked && isMultiSeries && canStackSeries(measureKeys);
  const { barScale, areaScale } = getSeriesValueScales({
    data,
    rows: chartRows,
    dataKeys,
    measureKeys,
    isGrouped,
    isStacked,
  });

  switch (chartType) {
    case "bar":
      return (
        <BarChartView
          sortedData={chartRows}
          dataKeys={dataKeys}
          // A grouped chart keeps its series colour and legend even when only one group came back.
          isMultiMeasure={isMultiSeries || isGrouped}
          hasCategoryAxis={hasCategoryAxis}
          xAxisKey={xAxisKey}
          chartConfig={chartConfig}
          formatDimensionValue={formatDimensionValue}
          isHorizontal={barOrientation === "horizontal"}
          isStacked={isStacked}
          yAxisScale={barScale}
          timeAxis={timeAxis}
          responseBaseKey={isGrouped ? undefined : responseBaseKey}
          seriesLabels={seriesLabels}
          tooltipValueFormatter={tooltipValueFormatter}
          valueAxisTickFormatter={valueAxisTickFormatter}
          formatValue={formatValue}
          measureAxisLabels={measureAxisLabelsFor(measureKeys, t)}
          locale={locale}
        />
      );
    // Line is a display style of this type, not a type of its own: both render the same Recharts
    // area series over the same axes and differ only in how the band under the stroke is painted.
    case "area":
      return (
        <AreaChartView
          rows={chartRows}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          hasCategoryAxis={hasCategoryAxis}
          formatDimensionValue={formatDimensionValue}
          timeAxis={timeAxis}
          responseBaseKey={isGrouped ? undefined : responseBaseKey}
          seriesLabels={seriesLabels}
          tooltipValueFormatter={tooltipValueFormatter}
          valueAxisTickFormatter={valueAxisTickFormatter}
          yAxisScale={areaScale}
          isLine={areaDisplay === "line"}
          isGrouped={isGrouped}
        />
      );
    case "pie":
      // A pie and a breakdown bar answer the same question — the share each group takes of the
      // whole — so they are two renderings of one chart type rather than two chart types.
      if (pieDisplay === "breakdown") {
        return (
          <BreakdownBars
            sortedData={chartRows}
            dataKeys={dataKeys}
            dataKey={dataKey}
            hasCategoryAxis={hasCategoryAxis}
            xAxisKey={xAxisKey}
            formatDimensionValue={formatDimensionValue}
            responseBaseKey={responseBaseKey}
          />
        );
      }
      return (
        <PieChartView
          sortedData={chartRows}
          dataKeys={dataKeys}
          dataKey={dataKey}
          isMultiMeasure={isMultiSeries}
          query={query}
          timeDimKey={timeDimKey}
          xAxisKey={xAxisKey}
          chartConfig={chartConfig}
          formatDimensionValue={formatDimensionValue}
          responseBaseKey={responseBaseKey}
          formatValue={formatValue}
          measureLabels={measureLabels}
        />
      );
    case "big_number":
      return (
        <BigNumberView
          value={computeBigNumberValue(data, dataKey)}
          formatted={formatValue(dataKey, computeBigNumberValue(data, dataKey))}
          label={formatCubeColumnHeader(dataKey, t, memberLabels)}
        />
      );
    default:
      return (
        <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center">
          {t("workspace.analysis.charts.chart_type_not_supported", { chartType })}
        </div>
      );
  }
}

/** A measure-only bar chart's bar labels: the short enum label where there is one ("Joy" for the
 * joy count), without a family prefix every bar shares. */
const measureAxisLabelsFor = (measureKeys: string[], t: TFunction): Record<string, string> => {
  const labels = stripSharedLabelPrefix(measureKeys.map((key) => getMeasureAxisLabel(key, t)));
  return Object.fromEntries(measureKeys.map((key, i) => [key, labels[i]]));
};

export function ChartRenderer({ fieldLabels, ...props }: Readonly<ChartRendererProps>) {
  const { t } = useTranslation();
  // One empty state for every chart type: a result with nothing in it would otherwise read as a
  // "0" big number or a bar chart with a single zero bar (see isChartResultEmpty for the rule).
  if (isChartResultEmpty(props.data, props.query)) {
    return <ChartEmptyState message={t("workspace.analysis.charts.no_data_available")} />;
  }
  // A matrix lays out two groupings on its own two axes, so none of the single-axis setup applies.
  if (props.chartType === "matrix") {
    return (
      <MatrixChart
        data={props.data}
        query={props.query}
        config={props.config}
        optionLabels={props.optionLabels}
        fieldLabels={fieldLabels}
        memberLabels={props.memberLabels}
      />
    );
  }
  return <SeriesChartRenderer {...props} />;
}
