import { z } from "zod";

// --- Base enums & primitives ---

export const ZDashboardStatus = z.enum(["published", "draft"]);
export type TDashboardStatus = z.infer<typeof ZDashboardStatus>;

export const ZChartType = z.enum([
  "area",
  "bar",
  "line",
  "pie",
  "big_number",
  "big_number_total",
  "table",
  "funnel",
  "map",
]);
export type TChartType = z.infer<typeof ZChartType>;

export const ZApiChartType = z.enum(["bar", "line", "donut", "kpi", "area", "pie"]);
export type TApiChartType = z.infer<typeof ZApiChartType>;

export const ZWidgetType = z.enum(["chart", "markdown", "header", "divider"]);
export type TWidgetType = z.infer<typeof ZWidgetType>;

// --- Layout ---

export const ZWidgetLayout = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type TWidgetLayout = z.infer<typeof ZWidgetLayout>;

// --- Cube.js query schemas (shared between actions & components) ---

export const ZTimeDimension = z.object({
  dimension: z.string(),
  granularity: z.enum(["hour", "day", "week", "month", "quarter", "year"]).optional(),
  dateRange: z.union([z.string(), z.array(z.string())]).optional(),
});
export type TTimeDimension = z.infer<typeof ZTimeDimension>;

export const ZFilterOperator = z.enum([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "set",
  "notSet",
  "gt",
  "gte",
  "lt",
  "lte",
]);
export type TFilterOperator = z.infer<typeof ZFilterOperator>;

export const ZCubeFilter = z.object({
  member: z.string(),
  operator: ZFilterOperator,
  values: z.array(z.string()).optional().nullable(),
});
export type TCubeFilter = z.infer<typeof ZCubeFilter>;

export const ZCubeQuery = z.object({
  measures: z.array(z.string()),
  dimensions: z.array(z.string()).optional(),
  timeDimensions: z.array(ZTimeDimension).optional(),
  filters: z.array(ZCubeFilter).optional(),
});
export type TCubeQuery = z.infer<typeof ZCubeQuery>;

// --- Chart config ---

export const ZChartConfig = z.record(z.string(), z.unknown());
export type TChartConfig = z.infer<typeof ZChartConfig>;

// --- Dashboard widget ---

export const ZDashboardWidgetChart = z.object({
  id: z.string(),
  name: z.string(),
  type: ZChartType,
  query: ZCubeQuery,
  config: ZChartConfig,
});
export type TDashboardWidgetChart = z.infer<typeof ZDashboardWidgetChart>;

export const ZDashboardWidget = z.object({
  id: z.string(),
  type: ZWidgetType,
  title: z.string().optional(),
  chartId: z.string().optional(),
  layout: ZWidgetLayout,
  chart: ZDashboardWidgetChart.optional(),
});
export type TDashboardWidget = z.infer<typeof ZDashboardWidget>;

// --- Dashboard ---

export const ZDashboard = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: ZDashboardStatus,
  lastModified: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  createdByName: z.string().optional(),
  chartCount: z.number(),
  widgets: z.array(ZDashboardWidget),
});
export type TDashboard = z.infer<typeof ZDashboard>;

// --- Chart ---

export const ZChart = z.object({
  id: z.string(),
  name: z.string(),
  type: ZChartType,
  lastModified: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  createdByName: z.string().optional(),
  dashboardIds: z.array(z.string()),
  config: ZChartConfig,
});
export type TChart = z.infer<typeof ZChart>;
