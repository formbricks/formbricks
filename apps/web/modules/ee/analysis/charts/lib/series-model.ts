import type { TFunction } from "i18next";
import {
  EMPTY_GROUP_VALUE,
  type TChartGrouping,
  assignSeriesColors,
  buildGroupedSeries,
  canStackSeries,
  orderGroupCombos,
  sortCategoryRows,
  sumSeries,
  toGroupKey,
} from "@/modules/ee/analysis/charts/lib/chart-series";
import {
  CHART_MEASURE_COLORS,
  formatXAxisTick,
  getSemanticDimensionColor,
  getSemanticMeasureColor,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { getChartDimensionValueLabel } from "@/modules/ee/analysis/charts/lib/dimension-value-label";
import { type YAxisScale, computeYAxis } from "@/modules/ee/analysis/charts/lib/y-axis-scale";
import { FEEDBACK_MEASURE_IDS, VALUE_ID_DIMENSION_ID } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

/** Synthetic column holding a category's total across its series (ordering and stacked axes). */
export const SERIES_TOTAL_KEY = "__seriesTotal";

/**
 * The measure columns a series chart draws, in the schema's canonical measure order — e.g. sentiment
 * from very positive → mixed — instead of the order the user happened to pick them. Unknown keys keep
 * their relative order at the end; grouping columns are never drawn as measures.
 */
export const orderMeasureKeys = (keys: readonly string[], dimensionKeys: readonly string[]): string[] => {
  const rank = (id: string): number => {
    const index = FEEDBACK_MEASURE_IDS.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return keys.filter((key) => !dimensionKeys.includes(key)).sort((a, b) => rank(a) - rank(b));
};

export interface TSeriesModel {
  /** Rows as drawn: pivoted to one column per series when grouped, ordered along the category axis. */
  rows: TChartDataRow[];
  /** One data key per drawn series. */
  dataKeys: string[];
  /** The measure behind each data key, for formatting its values. */
  seriesMeasure: Record<string, string>;
  /** Legend/tooltip label and color per data key. */
  seriesConfig: Record<string, { label: string; color: string }>;
}

interface TBuildSeriesModelInput {
  data: TChartDataRow[];
  grouping: TChartGrouping;
  xAxisKey: string;
  hasCategoryAxis: boolean;
  /** Whether further groupings are drawn as series on top of the category axis. */
  isGrouped: boolean;
  measureKeys: string[];
  measureLabels: Record<string, string>;
  optionLabels?: Record<string, string>;
  /** Display label of one grouping value (empty group, survey answer, enum value). */
  formatGroupValue: (dimensionId: string, value: unknown) => string;
}

/**
 * Everything a single-axis chart needs to draw its series: the rows in axis order, one data key per
 * series, the measure behind each, and each series' label and color.
 *
 * Grouped, every (measure, group value) pair is a series of its own and a group's color carries its
 * meaning where it has one (sentiment, NPS band, emotion). Ungrouped, each measure is a series and
 * takes its own semantic color. The palette goes only to series without a meaning.
 */
export const buildSeriesModel = (input: TBuildSeriesModelInput): TSeriesModel => {
  const model = input.isGrouped ? buildGroupedModel(input) : buildMeasureModel(input);
  if (!input.hasCategoryAxis || input.grouping.isTimeCategory) return model;

  // Recharts excludes raw booleans from its category domain in both grouped and ungrouped charts.
  const { xAxisKey } = input;
  return {
    ...model,
    rows: model.rows.map((row) => {
      const category = row[xAxisKey];
      return typeof category === "boolean" ? { ...row, [xAxisKey]: toGroupKey(category) } : row;
    }),
  };
};

const buildMeasureModel = ({
  data,
  grouping,
  xAxisKey,
  hasCategoryAxis,
  measureKeys,
  measureLabels,
  optionLabels,
}: TBuildSeriesModelInput): TSeriesModel => {
  // A time axis keeps the query's chronological order.
  const sortsByCategory = hasCategoryAxis && !grouping.isTimeCategory;
  const rows = sortsByCategory ? sortCategoryRows(data, xAxisKey, measureKeys[0], optionLabels) : data;
  const colors = assignSeriesColors(measureKeys.map(getSemanticMeasureColor), CHART_MEASURE_COLORS);
  return {
    rows,
    dataKeys: measureKeys,
    seriesMeasure: Object.fromEntries(measureKeys.map((key) => [key, key])),
    seriesConfig: Object.fromEntries(
      measureKeys.map((key, i) => [key, { label: measureLabels[key], color: colors[i] }])
    ),
  };
};

const buildGroupedModel = ({
  data,
  grouping,
  xAxisKey,
  measureKeys,
  measureLabels,
  optionLabels,
  formatGroupValue,
}: TBuildSeriesModelInput): TSeriesModel => {
  const grouped = buildGroupedSeries({
    rows: data,
    categoryKey: xAxisKey,
    groupKeys: grouping.groupKeys,
    measureKeys,
    groupOrder: (combos, weight) => orderGroupCombos(combos, grouping.groupKeys, weight, optionLabels),
  });
  const seriesKeys = grouped.series.map((entry) => entry.key);
  const rows = orderGroupedRows(grouped.rows, grouping, xAxisKey, seriesKeys, optionLabels);

  // A group's own color only means something when it is the one thing that varies between series.
  const singleGroup =
    grouping.groupKeys.length === 1 && measureKeys.length === 1 ? grouping.groupKeys[0] : undefined;
  const colors = assignSeriesColors(
    grouped.series.map((entry) =>
      singleGroup ? getSemanticDimensionColor(singleGroup, entry.groupValues[0]) : undefined
    ),
    CHART_MEASURE_COLORS
  );
  const labelFor = (measureKey: string, groupValues: string[]): string => {
    const groupLabel = groupValues
      .map((value, index) => formatGroupValue(grouping.groupKeys[index], value))
      .join(" · ");
    return measureKeys.length > 1 ? `${measureLabels[measureKey]} · ${groupLabel}` : groupLabel;
  };

  return {
    rows,
    dataKeys: seriesKeys,
    seriesMeasure: Object.fromEntries(grouped.series.map((entry) => [entry.key, entry.measureKey])),
    seriesConfig: Object.fromEntries(
      grouped.series.map((entry, i) => [
        entry.key,
        { label: labelFor(entry.measureKey, entry.groupValues), color: colors[i] },
      ])
    ),
  };
};

/** A time axis runs chronologically; a category axis follows its natural order, else largest total first. */
const orderGroupedRows = (
  rows: TChartDataRow[],
  grouping: TChartGrouping,
  xAxisKey: string,
  seriesKeys: string[],
  optionLabels?: Record<string, string>
): TChartDataRow[] => {
  if (grouping.isTimeCategory) {
    return [...rows].sort((a, b) => String(a[xAxisKey]).localeCompare(String(b[xAxisKey])));
  }
  const withTotals = rows.map((row) => ({ ...row, [SERIES_TOTAL_KEY]: sumSeries(row, seriesKeys) }));
  return sortCategoryRows(withTotals, xAxisKey, SERIES_TOTAL_KEY, optionLabels);
};

/**
 * Fill opacity of an area series: a line style's fading gradient, a faint band when one series per
 * group overlaps many others, else Recharts' usual area tint.
 */
export const getAreaFillOpacity = (isLine: boolean, isGrouped: boolean): number => {
  if (isLine) return 0.6;
  return isGrouped ? 0.15 : 0.4;
};

/**
 * One label for a grouping value everywhere it shows (axis, legend, tooltip): the shown empty group
 * by its name — "Not enriched", "Unspecified", else "(no value)" — survey answer text for a choice id,
 * a translated enum value, then the raw value.
 */
export const createGroupValueFormatter =
  (t: TFunction, optionLabels?: Record<string, string>) =>
  (dimensionId: string, value: unknown): string => {
    if (value === EMPTY_GROUP_VALUE) {
      return getChartDimensionValueLabel(dimensionId, null, t) ?? t("workspace.analysis.charts.no_value");
    }
    if (dimensionId === VALUE_ID_DIMENSION_ID && optionLabels && typeof value === "string") {
      return optionLabels[value] ?? value;
    }
    return getChartDimensionValueLabel(dimensionId, value, t) ?? formatXAxisTick(value);
  };

/**
 * Value axes a series chart cannot derive from its drawn rows alone, or undefined to let the chart do it.
 *
 * Grouped series live under synthetic keys, which carry no measure id for fixed-scale axes (an average
 * pinned to its 1–5 scale), so their axis is resolved from the original measure columns; counts start at
 * zero, since a group with no records in a bucket is drawn as 0. A stacked bar's axis has to reach the
 * tallest stack, not the tallest segment.
 */
export const getSeriesValueScales = ({
  data,
  rows,
  dataKeys,
  measureKeys,
  isGrouped,
  isStacked,
}: {
  data: TChartDataRow[];
  rows: TChartDataRow[];
  dataKeys: string[];
  measureKeys: string[];
  isGrouped: boolean;
  isStacked: boolean;
}): { barScale?: YAxisScale; areaScale?: YAxisScale } => {
  const groupedScale = isGrouped ? computeYAxis(data, measureKeys, canStackSeries(measureKeys)) : undefined;
  if (!isStacked) return { barScale: groupedScale, areaScale: groupedScale };
  const totals = rows.map((row) => ({ [SERIES_TOTAL_KEY]: sumSeries(row, dataKeys) }));
  return { barScale: computeYAxis(totals, [SERIES_TOTAL_KEY], true), areaScale: groupedScale };
};
