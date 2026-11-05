import { z } from "zod";
import { ZV3ChartData, ZV3ChartResource } from "@/app/api/v3/charts/lib/resources";
import { DASHBOARD_FILTER_OPERATORS } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";

/** A widget's place on the dashboard's 12-column grid. */
export const ZV3WidgetLayout = z
  .object({
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int(),
    h: z.number().int(),
  })
  .strict();

export type TV3WidgetLayout = z.infer<typeof ZV3WidgetLayout>;

const dashboardBase = {
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  creator: z.object({ name: z.string() }).strict().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

/** A dashboard in a list: its widgets counted rather than loaded, so a list stays cheap. */
export const ZV3DashboardListItem = z.object({ ...dashboardBase, widgetCount: z.number().int() }).strict();
export type TV3DashboardListItem = z.infer<typeof ZV3DashboardListItem>;

/** One chart's placement on a dashboard. `chart` is exactly what reading the chart returns. */
export const ZV3DashboardWidget = z
  .object({
    id: z.string(),
    chartId: z.string(),
    layout: ZV3WidgetLayout,
    order: z.number().int(),
    chart: ZV3ChartResource,
  })
  .strict();
export type TV3DashboardWidget = z.infer<typeof ZV3DashboardWidget>;

/**
 * One locked dashboard filter as read: the field, the operator and the values an editor locked it to, and
 * its label. Every read of the dashboard's charts applies it, whoever reads them.
 */
export const ZV3DashboardFilter = z
  .object({
    id: z.string(),
    field: z.string(),
    operator: z.enum(DASHBOARD_FILTER_OPERATORS),
    label: z.string(),
    values: z.array(z.string()),
  })
  .strict();
export type TV3DashboardFilter = z.infer<typeof ZV3DashboardFilter>;

export const ZV3DashboardResource = z
  .object({ ...dashboardBase, filters: z.array(ZV3DashboardFilter), widgets: z.array(ZV3DashboardWidget) })
  .strict();
export type TV3DashboardResource = z.infer<typeof ZV3DashboardResource>;

/**
 * A chart's data read through its dashboard: the chart data body, plus the picked filters the chart's
 * Feedback Dataset has no field for. When there are any, `rows` is empty: the chart cannot be narrowed to
 * the pick, so it shows nothing rather than more than was picked.
 */
export const ZV3DashboardChartData = ZV3ChartData.extend({
  unfilterableFilters: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
}).strict();
export type TV3DashboardChartData = z.infer<typeof ZV3DashboardChartData>;

/** One page of a dashboard filter's value list: up to 100 values in order, and whether more match. */
export const ZV3DashboardFilterValues = z
  .object({
    values: z.array(z.object({ value: z.string() }).strict()),
    hasMore: z.boolean(),
  })
  .strict();
export type TV3DashboardFilterValues = z.infer<typeof ZV3DashboardFilterValues>;

/**
 * The embedded-data fields a dashboard's filters can use: each key of the Feedback Datasets its charts read,
 * once, in key order, with the member a filter names (`FeedbackRecords.ed_*`) and the label it is shown by.
 */
export const ZV3DashboardFilterFields = z
  .object({
    fields: z.array(z.object({ name: z.string(), key: z.string(), label: z.string() }).strict()),
  })
  .strict();
export type TV3DashboardFilterFields = z.infer<typeof ZV3DashboardFilterFields>;
