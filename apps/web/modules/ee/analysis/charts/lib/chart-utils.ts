import { format, isValid, parseISO } from "date-fns";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_BRAND_DARK = "#00C4B8";
export const CHART_BRAND_LIGHT = "#00E6CA";

/** Shared categorical palette for bar cells, pie slices, and multi-measure series. */
export const CHART_MEASURE_COLORS = [
  CHART_BRAND_DARK,
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#14b8a6", // teal
];

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
  dataKey: string
): { processedData: TChartDataRow[]; colors: string[] } | null => {
  // Drop zero-value rows alongside non-numeric ones — Recharts can misalign
  // remaining slices when one entry has value 0.
  const validData = data.filter((row) => isNumericValue(row[dataKey]) && Number(row[dataKey]) > 0);
  const processedData = validData
    .map((row) => ({ ...row, [dataKey]: Number(row[dataKey]) }))
    .sort((a, b) => Number(b[dataKey]) - Number(a[dataKey]));
  if (processedData.length === 0) return null;

  const colors = processedData.map((_, i) => CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length]);
  return { processedData, colors };
};

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
