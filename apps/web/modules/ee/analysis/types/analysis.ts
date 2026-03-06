import { z } from "zod";
import { TWidgetLayout, ZChartConfig, ZChartQuery, ZWidgetLayout } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";

export const CHART_TYPE_IDS = ["area", "bar", "line", "pie", "big_number"] as const;
export const ZChartType = z.enum(CHART_TYPE_IDS);
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
  type: ZChartType,
  query: ZChartQuery,
  config: ZChartConfig,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TChart = z.infer<typeof ZChart>;

export const ZChartWithCreator = ZChart.extend({
  creator: z
    .object({
      name: z.string().nullable(),
    })
    .nullable(),
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
  createdBy: ZId,
});
export type TDashboardCreateInput = z.infer<typeof ZDashboardCreateInput>;

export const ZDashboardUpdateInput = z.object({
  name: z.string().min(1).optional(),
});
export type TDashboardUpdateInput = z.infer<typeof ZDashboardUpdateInput>;

// ── Dashboard output type (matches selectDashboard) ─────────────────────────

export type TDashboard = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
};

export type TDashboardWithCount = TDashboard & {
  creator: { name: string } | null;
  _count: { widgets: number };
};

// ── Widget input schema ─────────────────────────────────────────────────────

export const ZAddWidgetInput = z.object({
  dashboardId: ZId,
  chartId: ZId,
  projectId: ZId,
  layout: ZWidgetLayout,
});
export type TAddWidgetInput = z.infer<typeof ZAddWidgetInput>;

// ── Widget output type (matches getDashboard widget include) ────────────────

export type TDashboardWidget = {
  id: string;
  dashboardId: string;
  chartId: string;
  layout: TWidgetLayout;
  order: number;
  chart: TChart;
};

export type TDashboardDetail = TDashboard & {
  widgets: TDashboardWidget[];
};
// ── Charts UI (query execution, AI response) ─────────────────────────────────

/** Row from Cube.js tablePivot - keys are measure/dimension names, values are primitives */
export type TChartDataRow = Record<string, string | number | null | boolean | undefined>;

export interface AnalyticsResponse {
  query: z.infer<typeof ZChartQuery>;
  chartType: TChartType;
  data?: TChartDataRow[];
  error?: string;
}
