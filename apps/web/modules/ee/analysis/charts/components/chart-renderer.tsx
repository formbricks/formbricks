"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import { cn } from "@/lib/cn";
import { AreaChartView } from "@/modules/ee/analysis/charts/components/area-chart-view";
import { BarChartView } from "@/modules/ee/analysis/charts/components/bar-chart-view";
import { BreakdownBars } from "@/modules/ee/analysis/charts/components/breakdown-bars";
import { ChartEmptyState } from "@/modules/ee/analysis/charts/components/chart-empty-state";
import { MatrixChart } from "@/modules/ee/analysis/charts/components/matrix-chart";
import { PieChartView } from "@/modules/ee/analysis/charts/components/pie-chart-view";
import { ResponseBaseFooter } from "@/modules/ee/analysis/charts/components/response-base-footer";
import { computeBigNumberValue } from "@/modules/ee/analysis/charts/lib/big-number";
import { resolveChartDisplay } from "@/modules/ee/analysis/charts/lib/chart-display";
import { isChartResultEmpty } from "@/modules/ee/analysis/charts/lib/chart-emptiness";
import {
  canStackSeries,
  getChartGrouping,
  prepareGroupedRows,
  stripSharedLabelPrefix,
} from "@/modules/ee/analysis/charts/lib/chart-series";
import {
  formatMeasureAxisTick,
  formatMeasureValue,
  getSharedMeasureFormatId,
} from "@/modules/ee/analysis/charts/lib/measure-format";
import {
  type TValueFormatter,
  pivotsMeasuresIntoCategories,
} from "@/modules/ee/analysis/charts/lib/measure-pivot";
import { computeResponseBase } from "@/modules/ee/analysis/charts/lib/response-base";
import {
  buildSeriesModel,
  createGroupValueFormatter,
  getSeriesValueScales,
  orderMeasureKeys,
} from "@/modules/ee/analysis/charts/lib/series-model";
import { formatTimeBucket, getTimeGranularityFromKey } from "@/modules/ee/analysis/charts/lib/time-axis";
import {
  type TResponseBaseFamily,
  formatCubeColumnHeader,
  getMeasureAxisLabel,
  getResponseBaseFamily,
  getResponseBaseMeasureId,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";

/** Shown instead of a number when a measure had nothing to compute (an en dash, not a zero). */
const NO_DATA_PLACEHOLDER = "\u2013";

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
  const rows = prepareGroupedRows(data ?? [], dimensionKeys, query.measures ?? [], showEmptyValues);
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

  const pivotMeasures = pivotsMeasuresIntoCategories(chartType, hasCategoryAxis);

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
          pivotMeasures={pivotMeasures}
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
          pivotMeasures={pivotMeasures}
          formatValue={formatValue}
          measureAxisLabels={measureAxisLabelsFor(measureKeys, t)}
          locale={locale}
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

/** A measure-only bar, line or area chart's category labels: the short enum label where there is one
 * ("Joy" for the joy count), without a family prefix every measure shares. */
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
