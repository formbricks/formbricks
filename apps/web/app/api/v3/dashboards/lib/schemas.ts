import { z } from "zod";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";
import {
  GRID_COLUMNS,
  MAX_WIDGET_HEIGHT,
  MAX_WIDGET_Y,
} from "@/modules/ee/analysis/dashboards/lib/widget-placement";

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

/** A dashboard's name: unique within its workspace, trimmed, never empty. */
export const ZV3DashboardName = z.string().trim().min(1).max(V3_NAME_MAX_LENGTH);

export const ZV3DashboardCreateBody = z.object({ workspaceId: z.cuid2(), name: ZV3DashboardName }).strict();
export type TV3DashboardCreateBody = z.infer<typeof ZV3DashboardCreateBody>;

/** `PATCH /api/v3/dashboards/{dashboardId}` renames; the layout is saved with `PUT`. */
export const ZV3DashboardRenameBody = z.object({ name: ZV3DashboardName }).strict();
export type TV3DashboardRenameBody = z.infer<typeof ZV3DashboardRenameBody>;

/** `POST /api/v3/dashboards/{dashboardId}/duplicate`, optionally naming the copy. */
export const ZV3DashboardDuplicateBody = z.object({ name: ZV3DashboardName.optional() }).strict();
export type TV3DashboardDuplicateBody = z.infer<typeof ZV3DashboardDuplicateBody>;

/**
 * A widget's place on the 12-column grid, in whole grid units. Bounds the same limits the dashboard grid
 * enforces when a person drags or resizes, so a layout an agent writes is one a person can keep editing.
 */
export const ZV3WidgetLayoutInput = z
  .object({
    x: z
      .number()
      .int()
      .min(0)
      .max(GRID_COLUMNS - 1),
    y: z.number().int().min(0).max(MAX_WIDGET_Y),
    w: z.number().int().min(1).max(GRID_COLUMNS),
    h: z.number().int().min(1).max(MAX_WIDGET_HEIGHT),
  })
  .strict()
  .refine((layout) => layout.x + layout.w <= GRID_COLUMNS, {
    message: `x + w must not exceed the grid's ${GRID_COLUMNS} columns`,
    path: ["w"],
  });

export const ZV3DashboardWidgetParams = z.object({ dashboardId: z.cuid2(), widgetId: z.cuid2() }).strict();

/** `POST /api/v3/dashboards/{dashboardId}/widgets`: without a `layout`, the first open slot. */
export const ZV3WidgetCreateBody = z
  .object({ chartId: z.cuid2(), layout: ZV3WidgetLayoutInput.optional() })
  .strict();
export type TV3WidgetCreateBody = z.infer<typeof ZV3WidgetCreateBody>;

/** `PATCH /api/v3/dashboards/{dashboardId}/widgets/{widgetId}`: move, repoint, or both. */
export const ZV3WidgetUpdateBody = z
  .object({ layout: ZV3WidgetLayoutInput.optional(), chartId: z.cuid2().optional() })
  .strict()
  .refine((body) => body.layout !== undefined || body.chartId !== undefined, {
    message: "Send a layout, a chartId, or both.",
  });
export type TV3WidgetUpdateBody = z.infer<typeof ZV3WidgetUpdateBody>;
