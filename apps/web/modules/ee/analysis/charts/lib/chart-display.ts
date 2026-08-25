import type { TChartConfig } from "@formbricks/types/analysis";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export type TBarOrientation = NonNullable<TChartConfig["barOrientation"]>;
export type TPieDisplay = NonNullable<TChartConfig["pieDisplay"]>;

/** Charts render with vertical bars unless the saved config says otherwise. */
export const DEFAULT_BAR_ORIENTATION: TBarOrientation = "vertical";
/** A pie chart renders as a pie unless the saved config says otherwise. */
export const DEFAULT_PIE_DISPLAY: TPieDisplay = "pie";

/** Each setting so far belongs to exactly one chart type. */
export const supportsBarOrientation = (chartType: TChartType | undefined): boolean => chartType === "bar";
export const supportsPieDisplay = (chartType: TChartType | undefined): boolean => chartType === "pie";

/**
 * Big Number shows a single snapshot value and Pie shows composition at a point in time — bucketing
 * either into time series by granularity produces a chart that no longer answers the question its
 * type implies, which is what ENG-2541 flagged as confusing. Bar and Line/Area keep it: a trend over
 * time is exactly what those types are for.
 *
 * Only gates *grouping* (the granularity control). A time dimension with no granularity is a
 * date-range filter, not grouping — see `TimeDimensionConfig` — and stays available on every chart
 * type, including Big Number and Pie, since that's the only way to scope those to a rolling window
 * (the filters panel only supports absolute dates).
 */
export const supportsTimeGrouping = (chartType: TChartType | undefined): boolean =>
  chartType !== "big_number" && chartType !== "pie";

/**
 * Resolves the display settings a chart renders with. Charts saved before these settings
 * existed have an empty config, so every field falls back to the previous behavior.
 */
export const resolveChartDisplay = (
  config: TChartConfig | null | undefined
): { barOrientation: TBarOrientation; pieDisplay: TPieDisplay } => ({
  barOrientation: config?.barOrientation ?? DEFAULT_BAR_ORIENTATION,
  pieDisplay: config?.pieDisplay ?? DEFAULT_PIE_DISPLAY,
});

/**
 * Config to persist for a chart type: settings that the type does not support are dropped
 * rather than saved as dead values, so switching a bar chart to a pie chart doesn't keep a
 * stale orientation around to surprise whoever switches it back.
 */
export const sanitizeChartDisplay = (
  config: TChartConfig | null | undefined,
  chartType: TChartType | undefined
): TChartConfig => {
  const { barOrientation, pieDisplay, ...rest } = config ?? {};

  return {
    ...rest,
    ...(supportsBarOrientation(chartType) && barOrientation ? { barOrientation } : {}),
    ...(supportsPieDisplay(chartType) && pieDisplay ? { pieDisplay } : {}),
  };
};
