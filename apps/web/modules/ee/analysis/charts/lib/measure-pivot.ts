import type { TFunction } from "i18next";
import type { CartesianChartProps } from "@/modules/ee/analysis/charts/components/cartesian-chart";
import {
  PIVOTED_MEASURE_KEY,
  PIVOTED_VALUE_KEY,
  pivotMeasuresToCategories,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  formatMeasureAxisTick,
  getSharedMeasureFormatId,
} from "@/modules/ee/analysis/charts/lib/measure-format";
import { computeYAxis } from "@/modules/ee/analysis/charts/lib/y-axis-scale";
import {
  formatCubeColumnHeader,
  sortMeasureIdsForCategoryAxis,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";

/**
 * Whether a chart draws its measures as categories. A measure-only query (no dimension or time
 * grouping) returns one row with one column per measure; bar, line and area charts pivot it into one
 * category per measure. Pie folds measures into slices itself, and a big number shows one value.
 */
export const pivotsMeasuresIntoCategories = (chartType: TChartType, hasCategoryAxis: boolean): boolean =>
  !hasCategoryAxis && (chartType === "bar" || chartType === "area");

/** Formats a value by the measure behind its data key, in the app's locale. */
export type TValueFormatter = (dataKey: string, value: unknown) => string;

/** The CartesianChart props a measure-only chart shares once its measures are pivoted into categories. */
export type TPivotedMeasureChartProps = Pick<
  CartesianChartProps,
  | "data"
  | "xAxisKey"
  | "dataKeys"
  | "yAxisScale"
  | "tooltipHideLabel"
  | "xAxisTickFormatter"
  | "valueAxisTickFormatter"
  | "valueLabelFormatter"
  | "tooltipValueFormatter"
  | "responseBaseKey"
>;

export interface PivotedMeasureChartInput {
  sortedData: TChartDataRow[];
  dataKeys: string[];
  /** Short labels for the measures, keyed by measure id (shared prefix dropped). */
  measureAxisLabels?: Record<string, string>;
  formatValue: TValueFormatter;
  locale: string;
  responseBaseKey?: string;
  t: TFunction;
}

/**
 * Measure-only queries (no dimension or time grouping) return a single row with one column per
 * measure. Drawn as N series, that row is a single category: bars form one band centered in the plot
 * with a wide gap before the first (ENG-1796), and a line or area has one point per series and nothing
 * to join, so it draws blank (ENG-2618). Pivoting the measures into categories gives every
 * measure-only cartesian chart one point per measure along a measure axis.
 */
export const getPivotedMeasureChart = ({
  sortedData,
  dataKeys,
  measureAxisLabels,
  formatValue,
  locale,
  responseBaseKey,
  t,
}: PivotedMeasureChartInput): {
  chartProps: TPivotedMeasureChartProps;
  /** Formats a pivoted row's value by its own measure, for the value labels. */
  formatPointValue: (row: TChartDataRow | undefined) => string;
} => {
  // Sentiment measures pivot into the scale order the sentiment *dimension* axis uses,
  // so this chart and a dimension-grouped one read in the same direction.
  const axisKeys = sortMeasureIdsForCategoryAxis(dataKeys);
  const labelFor = (key: string) => measureAxisLabels?.[key] ?? formatCubeColumnHeader(key, t);
  // Pivoting collapses every measure onto PIVOTED_VALUE_KEY ("value"), which carries no measure
  // id, so an axis derived from the pivoted rows can't look up fixed-scale candidates and falls
  // back to data-driven "nice" bounds. Resolve the scale from the original measure columns so
  // rating/CSAT/CES/NPS averages still pin to the question scale, e.g. 3.3 on a 1-5 rating tops
  // the axis at 5, not 4 (ENG-2226).
  const sharedFormatMeasure = getSharedMeasureFormatId(axisKeys);
  const measureOf = (row: Record<string, unknown> | undefined) => {
    const measure = row?.[PIVOTED_MEASURE_KEY];
    return typeof measure === "string" ? measure : "";
  };
  return {
    chartProps: {
      data: pivotMeasuresToCategories(sortedData, axisKeys, labelFor, responseBaseKey),
      xAxisKey: PIVOTED_MEASURE_KEY,
      dataKeys: [PIVOTED_VALUE_KEY],
      yAxisScale: computeYAxis(sortedData, dataKeys, true),
      // Each tooltip row already carries the measure label; a header would only repeat it.
      tooltipHideLabel: true,
      xAxisTickFormatter: (value: unknown) => labelFor(typeof value === "string" ? value : ""),
      valueAxisTickFormatter: (value: unknown) => formatMeasureAxisTick(sharedFormatMeasure, value, locale),
      // Only sizes the flipped value-label gutter, so the shared format is close enough.
      valueLabelFormatter: (_key, value) => formatValue(sharedFormatMeasure ?? "", value),
      tooltipValueFormatter: (_key, value, row) => formatValue(measureOf(row), value),
      responseBaseKey,
    },
    formatPointValue: (row) => formatValue(measureOf(row), row?.[PIVOTED_VALUE_KEY]),
  };
};
