import type { TChartConfig } from "@formbricks/types/analysis";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export type TChartDisplayType = NonNullable<TChartConfig["displayType"]>;
export type TBarOrientation = NonNullable<TChartConfig["barOrientation"]>;

/** Charts render as the visualization with vertical bars unless the saved config says otherwise. */
export const DEFAULT_DISPLAY_TYPE: TChartDisplayType = "chart";
export const DEFAULT_BAR_ORIENTATION: TBarOrientation = "vertical";

/** Bar orientation is the only setting so far that applies to a single chart type. */
export const supportsBarOrientation = (chartType: TChartType | undefined): boolean => chartType === "bar";

/**
 * Resolves the display settings a chart renders with. Charts saved before these settings
 * existed have an empty config, so every field falls back to the previous behavior.
 */
export const resolveChartDisplay = (
  config: TChartConfig | null | undefined
): { displayType: TChartDisplayType; barOrientation: TBarOrientation } => ({
  displayType: config?.displayType ?? DEFAULT_DISPLAY_TYPE,
  barOrientation: config?.barOrientation ?? DEFAULT_BAR_ORIENTATION,
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
  const { barOrientation, ...rest } = config ?? {};

  return supportsBarOrientation(chartType) && barOrientation ? { ...rest, barOrientation } : rest;
};
