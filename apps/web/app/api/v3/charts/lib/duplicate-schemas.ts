import { z } from "zod";
import { ZV3WidgetLayoutInput } from "@/app/api/v3/dashboards/lib/schemas";
import { ZV3ChartName } from "./schemas";

/**
 * `POST /api/v3/charts/{chartId}/duplicate`. Kept apart from `schemas.ts` because it takes a widget
 * layout, and the dashboard schemas already import the chart ones.
 */
/** A layout only means something with a dashboard to place the copy on. Shared with MCP `duplicate_chart`. */
export const refuseLayoutWithoutDashboard = (
  body: { dashboardId?: unknown; layout?: unknown; pageId?: unknown },
  ctx: z.RefinementCtx
): void => {
  for (const field of ["layout", "pageId"] as const) {
    if (body[field] !== undefined && body.dashboardId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: `A ${field} places the copy on a dashboard: send dashboardId with it.`,
        path: [field],
      });
    }
  }
};

export const ZV3ChartDuplicateBody = z
  .object({
    name: ZV3ChartName.optional(),
    dashboardId: z.cuid2().optional(),
    /** The dashboard page the copy goes on; the dashboard's first page without one. */
    pageId: z.cuid2().optional(),
    layout: ZV3WidgetLayoutInput.optional(),
  })
  .strict()
  .superRefine(refuseLayoutWithoutDashboard);
export type TV3ChartDuplicateBody = z.infer<typeof ZV3ChartDuplicateBody>;
