import { z } from "zod";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";

/**
 * Request schemas for the dashboard operations. Every object is strict, so an argument the operation
 * does not take is a 400 naming it rather than something silently ignored.
 */

/** `GET /api/v3/dashboards`, with v3's `filter[field][operator]` spelling. */
export const ZV3DashboardListQuery = z
  .object({
    workspaceId: z.cuid2(),
    limit: z.coerce.number().int().min(1).max(V3_LIST_MAX_LIMIT).default(V3_LIST_DEFAULT_LIMIT),
    cursor: z.string().min(1).optional(),
    "filter[name][contains]": z.string().trim().min(1).max(V3_NAME_MAX_LENGTH).optional(),
    "filter[chartId][eq]": z.cuid2().optional(),
  })
  .strict();
export type TV3DashboardListQuery = z.infer<typeof ZV3DashboardListQuery>;

export const ZV3DashboardIdParams = z.object({ dashboardId: z.cuid2() }).strict();
