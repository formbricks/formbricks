import { z } from "zod";
import { ZV3ChartResource } from "@/app/api/v3/charts/lib/resources";

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

export const ZV3DashboardResource = z
  .object({ ...dashboardBase, widgets: z.array(ZV3DashboardWidget) })
  .strict();
export type TV3DashboardResource = z.infer<typeof ZV3DashboardResource>;
