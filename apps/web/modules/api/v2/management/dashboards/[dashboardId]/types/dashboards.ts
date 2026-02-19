import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZDashboardIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "dashboardId",
    description: "The ID of the dashboard",
    param: {
      name: "id",
      in: "path",
    },
  });

export const ZDashboardUpdateInput = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
  })
  .openapi({
    ref: "dashboardUpdate",
    description: "The fields to update on a dashboard.",
  });

export type TDashboardUpdateInput = z.infer<typeof ZDashboardUpdateInput>;
