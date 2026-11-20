import type { TChartConfig } from "@formbricks/types/analysis";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export type TBarOrientation = NonNullable<TChartConfig["barOrientation"]>;
export type TPieDisplay = NonNullable<TChartConfig["pieDisplay"]>;
export type TAreaDisplay = NonNullable<TChartConfig["areaDisplay"]>;

/** Charts render with vertical bars unless the saved config says otherwise. */
export const DEFAULT_BAR_ORIENTATION: TBarOrientation = "vertical";
/** A pie chart renders as a pie unless the saved config says otherwise. */
export const DEFAULT_PIE_DISPLAY: TPieDisplay = "pie";
/** An area chart renders as a filled band unless the saved config says otherwise. */
export const DEFAULT_AREA_DISPLAY: TAreaDisplay = "filled";

/** Several bar series stack into one bar per category unless the saved config says otherwise. */
export const DEFAULT_STACKED = true;
/** Groups with no value are left out unless the saved config says otherwise. */
export const DEFAULT_SHOW_EMPTY_VALUES = false;

/** Most settings belong to exactly one chart type. */
export const supportsBarOrientation = (chartType: TChartType | undefined): boolean => chartType === "bar";
export const supportsPieDisplay = (chartType: TChartType | undefined): boolean => chartType === "pie";
export const supportsAreaDisplay = (chartType: TChartType | undefined): boolean => chartType === "area";
export const supportsMatrixDisplay = (chartType: TChartType | undefined): boolean => chartType === "matrix";
/** The stacked / side-by-side switch: only bars put several series in one category. */
export const supportsBarLayout = (chartType: TChartType | undefined): boolean => chartType === "bar";
/** Every chart type that draws groups can show or hide the empty one; a big number has no groups. */
export const supportsEmptyValues = (chartType: TChartType | undefined): boolean =>
  chartType === "bar" || chartType === "area" || chartType === "pie" || chartType === "matrix";

/**
 * Whether a chart type has any display setting at all. The settings strip under the preview is only
 * rendered when it would hold something, so it never appears as an empty band.
 */
export const hasChartDisplaySettings = (chartType: TChartType | undefined): boolean =>
  supportsBarOrientation(chartType) ||
  supportsPieDisplay(chartType) ||
  supportsAreaDisplay(chartType) ||
  supportsMatrixDisplay(chartType) ||
  supportsEmptyValues(chartType);

/**
 * Big Number shows a single snapshot value and Pie shows composition at a point in time — bucketing
 * either into time series by granularity produces a chart that no longer answers the question its
 * type implies, which is what ENG-2541 flagged as confusing. A matrix already spends both of its
 * axes on groupings, so a time bucket would be a third axis it has nowhere to draw. Bar and Line/Area keep it: a trend over
 * time is exactly what those types are for.
 *
 * Only gates *grouping* (the granularity control). A time dimension with no granularity is a
 * date-range filter, not grouping — see `TimeDimensionConfig` — and stays available on every chart
 * type, including Big Number and Pie, since that's the only way to scope those to a rolling window
 * (the filters panel only supports absolute dates).
 */
export const supportsTimeGrouping = (chartType: TChartType | undefined): boolean =>
  chartType !== "big_number" && chartType !== "pie" && chartType !== "matrix";

/**
 * Resolves the display settings a chart renders with. Charts saved before these settings
 * existed have an empty config, so every field falls back to the previous behavior.
 */
export const resolveChartDisplay = (
  config: TChartConfig | null | undefined
): {
  barOrientation: TBarOrientation;
  pieDisplay: TPieDisplay;
  areaDisplay: TAreaDisplay;
  stacked: boolean;
  showEmptyValues: boolean;
} => ({
  barOrientation: config?.barOrientation ?? DEFAULT_BAR_ORIENTATION,
  pieDisplay: config?.pieDisplay ?? DEFAULT_PIE_DISPLAY,
  areaDisplay: config?.areaDisplay ?? DEFAULT_AREA_DISPLAY,
  stacked: config?.stacked ?? DEFAULT_STACKED,
  showEmptyValues: config?.showEmptyValues ?? DEFAULT_SHOW_EMPTY_VALUES,
});

/** The saved matrix settings, kept only on a matrix. */
const pickMatrixDisplay = (config: TChartConfig): TChartConfig => {
  const { matrixCellValue, matrixColorScale, matrixShowTotals, matrixTranspose } = config;
  return {
    ...(matrixCellValue ? { matrixCellValue } : {}),
    ...(matrixColorScale === undefined ? {} : { matrixColorScale }),
    ...(matrixShowTotals === undefined ? {} : { matrixShowTotals }),
    ...(matrixTranspose === undefined ? {} : { matrixTranspose }),
  };
};

/** Keeps `value` under `key` when the chart type supports it and it is set. */
const keepIf = <K extends keyof TChartConfig>(
  supported: boolean,
  key: K,
  value: TChartConfig[K]
): TChartConfig => (supported && value !== undefined ? { [key]: value } : {});

/**
 * Config to persist for a chart type: settings that the type does not support are dropped
 * rather than saved as dead values, so switching a bar chart to a pie chart doesn't keep a
 * stale orientation around to surprise whoever switches it back.
 */
export const sanitizeChartDisplay = (
  config: TChartConfig | null | undefined,
  chartType: TChartType | undefined
): TChartConfig => {
  const {
    barOrientation,
    pieDisplay,
    areaDisplay,
    matrixCellValue: _matrixCellValue,
    matrixColorScale: _matrixColorScale,
    matrixShowTotals: _matrixShowTotals,
    matrixTranspose: _matrixTranspose,
    stacked,
    showEmptyValues,
    ...rest
  } = config ?? {};

  return {
    ...rest,
    ...keepIf(supportsBarOrientation(chartType), "barOrientation", barOrientation || undefined),
    ...keepIf(supportsPieDisplay(chartType), "pieDisplay", pieDisplay || undefined),
    ...keepIf(supportsAreaDisplay(chartType), "areaDisplay", areaDisplay || undefined),
    ...(supportsMatrixDisplay(chartType) ? pickMatrixDisplay(config ?? {}) : {}),
    ...keepIf(supportsBarLayout(chartType), "stacked", stacked),
    ...keepIf(supportsEmptyValues(chartType), "showEmptyValues", showEmptyValues),
  };
};
