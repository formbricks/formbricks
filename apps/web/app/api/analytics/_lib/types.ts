/**
 * TypeScript types for the Analytics API
 */

export interface TimeDimension {
  dimension: string;
  granularity?: "day" | "week" | "month" | "year";
  dateRange?: string;
}

export interface Filter {
  member: string;
  operator:
    | "equals"
    | "notEquals"
    | "contains"
    | "notContains"
    | "set"
    | "notSet"
    | "gt"
    | "gte"
    | "lt"
    | "lte";
  values?: string[] | null;
}

export interface CubeQuery {
  measures: string[];
  dimensions?: string[];
  timeDimensions?: TimeDimension[];
  filters?: Filter[];
}

export interface AnalyticsResponse {
  query: CubeQuery;
  chartType: "bar" | "line" | "donut" | "kpi" | "area" | "pie";
  data?: Record<string, any>[];
  error?: string;
}
