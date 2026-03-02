import { format, isValid, parseISO } from "date-fns";
import type { TChartQuery } from "@formbricks/types/analysis";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_BRAND_DARK = "#00C4B8";
export const CHART_BRAND_LIGHT = "#00E6CA";

/** Palette for multi-measure charts (grouped/stacked bars, multi-series line/area). */
export const CHART_MEASURE_COLORS = [
  CHART_BRAND_DARK,
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#14b8a6", // teal
];

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

/** Format a value for x-axis ticks; ISO date strings become "MMM d, yyyy", others pass through. */
export function formatXAxisTick(value: TChartDataRow[string]): string {
  if (value == null) return "";
  let str: string;
  if (typeof value === "string") str = value;
  else if (typeof value === "number") str = String(value);
  else return "";
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
    const date = parseISO(value);
    if (isValid(date)) return format(date, "MMM d, yyyy");
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

const ALLOWED_CUBE_PREFIXES = ["FeedbackRecords.", "TopicsUnnested."];

function validateMember(member: string): boolean {
  return ALLOWED_CUBE_PREFIXES.some((prefix) => member.startsWith(prefix));
}

/**
 * Validates that all measures, dimensions, segments, timeDimensions, and filters
 * use only members from FeedbackRecords or joined cubes (e.g. TopicsUnnested).
 * @throws Error if any member is invalid
 */
export function validateQueryMembers(query: TChartQuery): void {
  const invalid: string[] = [];
  for (const m of query.measures ?? []) {
    if (!validateMember(m)) invalid.push(m);
  }
  for (const d of query.dimensions ?? []) {
    if (!validateMember(d)) invalid.push(d);
  }
  for (const s of query.segments ?? []) {
    if (!validateMember(s)) invalid.push(s);
  }
  for (const td of query.timeDimensions ?? []) {
    if (!validateMember(td.dimension)) invalid.push(td.dimension);
  }
  const checkFilters = (f: TChartQuery["filters"]): void => {
    if (!f) return;
    for (const item of f) {
      if ("member" in item && typeof item.member === "string" && !validateMember(item.member)) {
        invalid.push(item.member);
      }
      if ("and" in item && Array.isArray(item.and)) checkFilters(item.and);
      if ("or" in item && Array.isArray(item.or)) checkFilters(item.or);
    }
  };
  checkFilters(query.filters);
  if (invalid.length > 0) {
    throw new Error(
      `Invalid query members (must start with FeedbackRecords. or TopicsUnnested.): ${invalid.join(", ")}`
    );
  }
}
