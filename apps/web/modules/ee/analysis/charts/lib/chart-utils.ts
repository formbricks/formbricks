import { format, isValid, parseISO } from "date-fns";
import type { TApiChartType, TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";

// Chart brand colors (used by chart rendering utilities)
export const CHART_BRAND_DARK = "#00C4B8";
export const CHART_BRAND_LIGHT = "#00E6CA";

/**
 * Map API chart type (used in AnalyticsResponse) to database chart type (Prisma enum).
 */
export const mapChartType = (apiType: string): TChartType => {
  const mapping: Record<string, TChartType> = {
    bar: "bar",
    line: "line",
    area: "area",
    pie: "pie",
    donut: "pie",
    kpi: "big_number",
    big_number: "big_number",
  };
  return mapping[apiType] || "bar";
};

/**
 * Reverse mapping from database chart type to API chart type (for rendering).
 */
export const mapDatabaseChartTypeToApi = (dbType: string): TApiChartType => {
  const mapping: Record<string, TApiChartType> = {
    bar: "bar",
    line: "line",
    area: "area",
    pie: "pie",
    big_number: "kpi",
    table: "bar",
  };
  return mapping[dbType] || "bar";
};

const isNumericValue = (val: TChartDataRow[string]): boolean => {
  if (val === null || val === undefined || val === "") return false;
  const num = Number(val);
  return !Number.isNaN(num) && Number.isFinite(num);
};

export const resolveChartKeys = (
  data: TChartDataRow[],
  chartType: string
): { xAxisKey: string; dataKey: string } => {
  const firstRow = data[0];
  const keys = Object.keys(firstRow).filter((k) => k !== "date" && k !== "time");

  if (chartType === "pie" || chartType === "donut") {
    const numericKey = keys.find((key) => isNumericValue(firstRow[key]));
    const nonNumericKey = keys.find((key) => key !== numericKey && firstRow[key] !== undefined);
    const xAxisKey =
      nonNumericKey || (numericKey ? (keys.find((k) => k !== numericKey) ?? null) : null) || keys[0] || "key";
    const dataKey = numericKey || keys[1] || keys[0] || "value";
    return { xAxisKey, dataKey };
  }

  let xAxisKey = keys[0] ?? "key";
  if (firstRow.date) xAxisKey = "date";
  else if (firstRow.time) xAxisKey = "time";
  const dataKey = keys.find((k) => k !== xAxisKey) || keys[0] || "value";
  return { xAxisKey, dataKey };
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
