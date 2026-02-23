import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZChartConfig, ZChartQuery, ZWidgetLayout } from "@formbricks/types/dashboard";

export const ZChartType = z.enum(["area", "bar", "line", "pie", "big_number"]);
export type TChartType = z.infer<typeof ZChartType>;

// ── Chart input schemas ─────────────────────────────────────────────────────

export const ZChartCreateInput = z.object({
  projectId: ZId,
  name: z.string().min(1),
  type: ZChartType,
  query: ZChartQuery,
  config: ZChartConfig,
  createdBy: ZId,
});
export type TChartCreateInput = z.infer<typeof ZChartCreateInput>;

export const ZChartUpdateInput = z.object({
  name: z.string().min(1).optional(),
  type: ZChartType.optional(),
  query: ZChartQuery.optional(),
  config: ZChartConfig.optional(),
});
export type TChartUpdateInput = z.infer<typeof ZChartUpdateInput>;

// ── Chart output type (matches selectChart) ─────────────────────────────────

export const ZChart = z.object({
  id: ZId,
  name: z.string(),
  type: z.string(),
  query: ZChartQuery,
  config: ZChartConfig,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TChart = z.infer<typeof ZChart>;

export const ZChartWithCreator = ZChart.extend({
  creator: z.object({
    name: z.string().nullable(),
  }),
});
export type TChartWithCreator = z.infer<typeof ZChartWithCreator>;

export const ZChartWithWidgets = ZChart.extend({
  widgets: z.array(z.object({ dashboardId: ZId })),
});
export type TChartWithWidgets = z.infer<typeof ZChartWithWidgets>;

// ── Dashboard input schemas ─────────────────────────────────────────────────

export const ZDashboardCreateInput = z.object({
  projectId: ZId,
  name: z.string().min(1),
  description: z.string().optional(),
  createdBy: ZId,
});
export type TDashboardCreateInput = z.infer<typeof ZDashboardCreateInput>;

export const ZDashboardUpdateInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
});
export type TDashboardUpdateInput = z.infer<typeof ZDashboardUpdateInput>;

// ── Dashboard output type (matches selectDashboard) ─────────────────────────

export type TDashboard = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TDashboardWithCount = TDashboard & {
  _count: { widgets: number };
};

// ── Widget input schema ─────────────────────────────────────────────────────

export const ZAddWidgetInput = z.object({
  dashboardId: ZId,
  chartId: ZId,
  projectId: ZId,
  title: z.string().optional(),
  layout: ZWidgetLayout,
});
export type TAddWidgetInput = z.infer<typeof ZAddWidgetInput>;

// ── Charts UI (query execution, AI response) ─────────────────────────────────

export const ZApiChartType = z.enum(["bar", "line", "donut", "kpi", "area", "pie"]);
export type TApiChartType = z.infer<typeof ZApiChartType>;

export const ZTimeDimension = z.object({
  dimension: z.string(),
  granularity: z.enum(["hour", "day", "week", "month", "quarter", "year"]).optional(),
  dateRange: z.union([z.string(), z.tuple([z.string(), z.string()])]).optional(),
});
export type TTimeDimension = z.infer<typeof ZTimeDimension>;

export const ZCubeFilter = z.object({
  member: z.string(),
  operator: z.string(),
  values: z.array(z.string()).optional(),
});
export type TCubeFilter = z.infer<typeof ZCubeFilter>;

export const ZCubeQuery = z.object({
  measures: z.array(z.string()),
  dimensions: z.array(z.string()).optional(),
  timeDimensions: z.array(ZTimeDimension).optional(),
  filters: z.array(ZCubeFilter).optional(),
});
export type TCubeQuery = z.infer<typeof ZCubeQuery>;

/** Row from Cube.js tablePivot - keys are measure/dimension names, values are primitives */
export type TChartDataRow = Record<string, string | number | null | boolean | undefined>;

export interface AnalyticsResponse {
  query: z.infer<typeof ZChartQuery>;
  chartType: TApiChartType;
  data?: TChartDataRow[];
  error?: string;
}
