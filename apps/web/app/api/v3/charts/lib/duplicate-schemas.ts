import { z } from "zod";
import { ZV3WidgetLayoutInput } from "@/app/api/v3/dashboards/lib/schemas";
import { ZV3ChartName } from "./schemas";

/**
 * `POST /api/v3/charts/{chartId}/duplicate`. Kept apart from `schemas.ts` because it takes a widget
 * layout, and the dashboard schemas already import the chart ones.
 */
export const ZV3ChartDuplicateBody = z
  .object({
    name: ZV3ChartName.optional(),
    dashboardId: z.cuid2().optional(),
    layout: ZV3WidgetLayoutInput.optional(),
  })
  .strict()
  .refine((body) => body.layout === undefined || body.dashboardId !== undefined, {
    message: "A layout places the copy on a dashboard: send dashboardId with it.",
    path: ["layout"],
  });
export type TV3ChartDuplicateBody = z.infer<typeof ZV3ChartDuplicateBody>;
