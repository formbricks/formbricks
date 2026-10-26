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

/**
 * A widget update must change something: an empty one would still move the dashboard's `updatedAt`, and
 * every editor's next save would then be refused as stale. Shared with the MCP `update_widget` input.
 */
export const refuseEmptyWidgetUpdate = (
  body: { layout?: unknown; chartId?: unknown },
  ctx: z.RefinementCtx
): void => {
  if (body.layout === undefined && body.chartId === undefined) {
    ctx.addIssue({ code: "custom", message: "Send a layout, a chartId, or both." });
  }
};

/** `PATCH /api/v3/dashboards/{dashboardId}/widgets/{widgetId}`: move, repoint, or both. */
export const ZV3WidgetUpdateBody = z
  .object({ layout: ZV3WidgetLayoutInput.optional(), chartId: z.cuid2().optional() })
  .strict()
  .superRefine(refuseEmptyWidgetUpdate);
export type TV3WidgetUpdateBody = z.infer<typeof ZV3WidgetUpdateBody>;

/** The most widgets a whole-dashboard write carries; far past what a dashboard can show. */
export const MAX_DASHBOARD_WIDGETS = 250;

/**
 * `expectedUpdatedAt`: the dashboard's `updatedAt` from the caller's read, the write's precondition. Named as
 * the survey writes name it, so it never reads as a timestamp the caller sets; 409 if it changed since.
 */
const ZV3ExpectedDashboardUpdatedAt = z.iso.datetime({ offset: true });

/** A whole-dashboard write lists each widget once. Shared with the MCP `update_dashboard_layout` input. */
export const refuseRepeatedWidgets = (widgets: { widgetId: string }[], ctx: z.RefinementCtx): void => {
  const seen = new Set<string>();
  widgets.forEach(({ widgetId }, index) => {
    if (seen.has(widgetId)) {
      ctx.addIssue({ code: "custom", message: "Each widget may appear once.", path: ["widgets", index] });
    }
    seen.add(widgetId);
  });
};

/**
 * `PUT /api/v3/dashboards/{dashboardId}`: the name and every widget's place, in one write. A widget left
 * out of `widgets` is removed — this is the app's save, which sends the whole edited dashboard.
 */
export const ZV3DashboardReplaceBody = z
  .object({
    name: ZV3DashboardName,
    expectedUpdatedAt: ZV3ExpectedDashboardUpdatedAt,
    widgets: z
      .array(
        z
          .object({
            widgetId: z.cuid2(),
            layout: ZV3WidgetLayoutInput,
            order: z.number().int().min(0).max(MAX_DASHBOARD_WIDGETS),
          })
          .strict()
      )
      .max(MAX_DASHBOARD_WIDGETS),
  })
  .strict()
  .superRefine((body, ctx) => refuseRepeatedWidgets(body.widgets, ctx));
export type TV3DashboardReplaceBody = z.infer<typeof ZV3DashboardReplaceBody>;

/**
 * The rearrange `updateV3DashboardLayout` takes: every current widget's layout, and nothing else. Listing
 * exactly the current widgets is the rule, so a rearrange can never remove a widget by leaving it out. The
 * MCP `update_dashboard_layout` input carries the same bound and the same repeated-widget check.
 */
export const ZV3DashboardLayoutBody = z
  .object({
    expectedUpdatedAt: ZV3ExpectedDashboardUpdatedAt,
    widgets: z
      .array(z.object({ widgetId: z.cuid2(), layout: ZV3WidgetLayoutInput }).strict())
      .max(MAX_DASHBOARD_WIDGETS),
  })
  .strict()
  .superRefine((body, ctx) => refuseRepeatedWidgets(body.widgets, ctx));
export type TV3DashboardLayoutBody = z.infer<typeof ZV3DashboardLayoutBody>;
