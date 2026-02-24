import { format, isValid, parseISO } from "date-fns";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_BRAND_DARK = "#00C4B8";
export const CHART_BRAND_LIGHT = "#00E6CA";

/** Validate a chart type string, defaulting to "bar" if unrecognised. */
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
  const validData = data.filter((row) => isNumericValue(row[dataKey]));
  const processedData = validData.map((row) => ({ ...row, [dataKey]: Number(row[dataKey]) }));
  if (processedData.length === 0) return null;

  const colors = processedData.map((_, i) => {
    const sat = 70 + (i % 3) * 10;
    const light = 45 + (i % 2) * 15;
    return `hsl(180, ${sat}%, ${light}%)`;
  });
  if (colors.length > 0) colors[0] = CHART_BRAND_DARK;
  if (colors.length > 1) colors[1] = CHART_BRAND_LIGHT;
  return { processedData, colors };
};

/**
 * Format a cell value for display in tables and tooltips.
 * ISO date strings become "MMM d, yyyy"; numbers stay as-is (formatted); objects are stringified.
 */
export function formatCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === "string") {
    const date = parseISO(value);
    if (isValid(date)) return format(date, "MMM d, yyyy");
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}
