import { format, isValid, parseISO } from "date-fns";
import { isNotEnrichedDimensionValue } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_BRAND_DARK = "#00C4B8";
export const CHART_BRAND_LIGHT = "#00E6CA";

/**
 * Shared categorical palette for bar cells, pie slices, and multi-measure series. Assigned by index
 * (never cycled for meaning). Eight distinct hues, ordered to maximize adjacent colorblind
 * separation — validated with the dataviz palette script (worst adjacent CVD ΔE ≈ 38 on white, well
 * above the ≥12 target). The previous 6-hue set repeated teal (#00C4B8 vs #14b8a6) and blue/violet,
 * which collided on the 6-category emotion/sentiment charts.
 */
export const CHART_MEASURE_COLORS = [
  CHART_BRAND_DARK, // teal (brand)
  "#2a78d6", // blue
  "#eda100", // yellow
  "#e34948", // red
  "#4a3aa7", // violet
  "#eb6834", // orange
  "#e87ba4", // magenta
  "#008300", // green
];

/** Neutral gray for the "not enriched" bucket (empty sentiment/emotion values). Reads as muted in
 * both light and dark so it doesn't compete with the categorical palette. */
export const CHART_NOT_ENRICHED_COLOR = "#94a3b8"; // slate-400

/** Validate a chart type string, defaulting to "bar" if unrecognized. */
export const resolveChartType = (raw: string): TChartType => {
  const parsed = ZChartType.safeParse(raw);
  return parsed.success ? parsed.data : "bar";
};

const isNumericValue = (val: TChartDataRow[string]): boolean => {
  if (val === null || val === undefined || val === "") return false;
  const num = Number(val);
  return !Number.isNaN(num) && Number.isFinite(num);
};

export const preparePieData = (
  data: TChartDataRow[],
  dataKey: string,
  nameKey?: string
): { processedData: TChartDataRow[]; colors: string[] } | null => {
  // Drop zero-value rows alongside non-numeric ones. With `minAngle={2}` on
  // `<Pie>`, a `value: 0` slice gets stretched to 2° of visible arc and the
  // label math (driven by midAngle) then implies a non-zero share, so callouts
  // line up off the data. Trade-off: real "0" categories (e.g. a Neutral
  // sentiment bucket with no responses) disappear from both the pie and the
  // legend; surfacing those in the legend is tracked as a follow-up.
  const validData = data.filter((row) => isNumericValue(row[dataKey]) && Number(row[dataKey]) > 0);
  const processedData = validData
    .map((row) => ({ ...row, [dataKey]: Number(row[dataKey]) }))
    .sort((a, b) => Number(b[dataKey]) - Number(a[dataKey]));
  if (processedData.length === 0) return null;

  // The "not enriched" slice takes a neutral gray; palette colors are handed out only to the
  // enriched slices so the gray bucket doesn't consume a categorical hue.
  let paletteIndex = 0;
  const colors = processedData.map((row) => {
    if (nameKey && isNotEnrichedDimensionValue(nameKey, row[nameKey])) {
      return CHART_NOT_ENRICHED_COLOR;
    }
    const color = CHART_MEASURE_COLORS[paletteIndex % CHART_MEASURE_COLORS.length];
    paletteIndex++;
    return color;
  });
  return { processedData, colors };
};

export const PIE_MEASURE_NAME_KEY = "__measureName";
export const PIE_MEASURE_VALUE_KEY = "__measureValue";

/**
 * Pivot several measures (one/few rows, N measure columns) into one row per measure, so a pie
 * chart with multiple measures and no dimension renders a slice per measure instead of only the
 * first one. Each measure is summed across the given rows.
 */
export const prepareMeasureSliceData = (
  rows: TChartDataRow[],
  measureKeys: string[],
  labelFor: (key: string) => string
): TChartDataRow[] =>
  measureKeys.map((key) => ({
    [PIE_MEASURE_NAME_KEY]: labelFor(key),
    [PIE_MEASURE_VALUE_KEY]: rows.reduce(
      (sum, row) => sum + (isNumericValue(row[key]) ? Number(row[key]) : 0),
      0
    ),
  }));

/** Category key for rows produced by {@link pivotMeasuresToCategories}. */
export const PIVOTED_MEASURE_KEY = "measure";
/** Value key for rows produced by {@link pivotMeasuresToCategories}. */
export const PIVOTED_VALUE_KEY = "value";

/**
 * Pivot a measure-only result row (one row with one column per measure) into one category row
 * per measure. Rendering the raw row as N bar series leaves recharts with a single category
 * band centered in the plot — a wide empty gap before the first bar. Pivoted, the measures
 * become ordinary categories that fill the x-axis from the left.
 *
 * Missing/non-numeric values become 0 so empty measures keep a visible, hoverable slot.
 * `formatLabel` supplies the translated measure label stored as `tooltipLabel` on each row.
 */
export function pivotMeasuresToCategories(
  data: TChartDataRow[],
  measureKeys: string[],
  formatLabel: (measureKey: string) => string
): TChartDataRow[] {
  const row = data[0] ?? {};
  return measureKeys.map((key, index) => {
    const num = Number(row[key]);
    return {
      [PIVOTED_MEASURE_KEY]: key,
      [PIVOTED_VALUE_KEY]: Number.isFinite(num) ? num : 0,
      tooltipLabel: formatLabel(key),
      fill: CHART_MEASURE_COLORS[index % CHART_MEASURE_COLORS.length],
    };
  });
}

// parseISO accepts year-only inputs (e.g. "1000" → Jan 1, 1000); require a
// full YYYY-MM-DD prefix so numeric category labels aren't formatted as dates.
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

const isLikelyIsoDateString = (str: string): boolean => ISO_DATE_PREFIX.test(str);

/** Format a value for x-axis ticks; ISO date strings become "MMM d, yyyy", others pass through. */
export function formatXAxisTick(value: unknown): string {
  if (value == null) return "";
  let str: string;
  if (typeof value === "string") str = value;
  else if (typeof value === "number") str = String(value);
  else return "";
  if (!isLikelyIsoDateString(str)) return str;
  const date = parseISO(str);
  if (isValid(date)) return format(date, "MMM d, yyyy");
  return str;
}

/**
 * Format a cell value for display in tables and tooltips.
 * ISO date strings become "MMM d, yyyy"; numbers stay as-is (formatted); objects are stringified.
 */
export function formatCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === "string") {
    if (!isLikelyIsoDateString(value)) return value;
    const date = parseISO(value);
    if (isValid(date)) return format(date, "MMM d, yyyy");
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}
