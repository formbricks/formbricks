import { TApiChartType, TChartType } from "../types/analysis";

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
    big_number_total: "kpi",
    table: "bar",
    funnel: "bar",
    map: "bar",
  };
  return mapping[dbType] || "bar";
};
