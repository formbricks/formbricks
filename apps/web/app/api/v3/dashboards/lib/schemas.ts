import { z } from "zod";
import {
  ZDashboardImageContent,
  ZDashboardTextContent,
  ZDashboardWidgetKind,
} from "@formbricks/types/analysis";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";
import { zPostgresText } from "@/lib/utils/postgres-text";
import { findPickIssues, splitPickParams } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import { FILTER_RULE_ID } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-rules";
import {
  MAX_DASHBOARD_FILTERS,
  MAX_DASHBOARD_FILTER_PICK_VALUES,
  MAX_DASHBOARD_FILTER_PICK_VALUE_LENGTH,
  type TLockedDashboardFilter,
  ZLockedDashboardFilter,
  findDashboardFilterIssues,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { MAX_DASHBOARD_PAGES, MAX_PAGE_NAME_LENGTH } from "@/modules/ee/analysis/dashboards/lib/page-names";
import {
  GRID_COLUMNS,
  MAX_WIDGET_HEIGHT,
  MAX_WIDGET_Y,
} from "@/modules/ee/analysis/dashboards/lib/widget-placement";

/**
 * Request schemas for the dashboard operations. Every object is strict, so an argument the operation
 * does not take is a 400 naming it rather than something silently ignored.
 */

/**
 * View as (ENG-7484): the member a dashboard read runs as. Only an Owner or Manager session may pass it,
 * only on dashboard reads; the read is decided and its records chosen as that member's own.
 */
const viewAsParam = { viewAs: z.cuid2().optional() };

/** `GET /api/v3/dashboards/{dashboardId}`: nothing but `viewAs`. */
export const ZV3DashboardReadQuery = z.object(viewAsParam).strict();

/** `GET /api/v3/dashboards`, with v3's `filter[field][operator]` spelling. */
export const ZV3DashboardListQuery = z
  .object({
    ...viewAsParam,
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

// ── Dashboard pages (ENG-7480) ──────────────────────────────────────────────────────────────

export {
  DEFAULT_DASHBOARD_PAGE_NAME,
  MAX_DASHBOARD_PAGES,
  MAX_PAGE_NAME_LENGTH,
} from "@/modules/ee/analysis/dashboards/lib/page-names";

/** The most teams one page may be limited to. */
export const MAX_PAGE_TEAMS = 100;

/** A page's name: trimmed, never empty. Names may repeat within a dashboard. */
export const ZV3DashboardPageName = z.string().trim().min(1).max(MAX_PAGE_NAME_LENGTH);

/** Refuses a team listed twice in a page's limit. */
const refuseRepeatedTeams = (teamIds: readonly string[] | null | undefined, ctx: z.RefinementCtx): void => {
  if (!teamIds) return;
  const seen = new Set<string>();
  teamIds.forEach((teamId, index) => {
    if (seen.has(teamId))
      ctx.addIssue({ code: "custom", message: "Each team may appear once.", path: [index] });
    seen.add(teamId);
  });
};

/**
 * The teams a page is limited to. `null` or an empty list means no limit ("All teams"). Changing it needs
 * Owner or Manager and the Access Control feature (`dashboard.manage_access`).
 */
export const ZV3PageTeamIds = z
  .array(z.cuid2())
  .max(MAX_PAGE_TEAMS)
  .nullable()
  .superRefine(refuseRepeatedTeams);

export const ZV3DashboardPageParams = z.object({ dashboardId: z.cuid2(), pageId: z.cuid2() }).strict();

/** `POST /api/v3/dashboards/{dashboardId}/pages`: a new page, last, open to all teams. */
export const ZV3PageCreateBody = z.object({ name: ZV3DashboardPageName }).strict();
export type TV3PageCreateBody = z.infer<typeof ZV3PageCreateBody>;

/** A page update must change something, or it would move `updatedAt` for nothing. */
export const refuseEmptyPageUpdate = (
  body: { name?: unknown; teamIds?: unknown },
  ctx: z.RefinementCtx
): void => {
  if (body.name === undefined && body.teamIds === undefined) {
    ctx.addIssue({ code: "custom", message: "Send a name, teamIds, or both." });
  }
};

/** `PATCH /api/v3/dashboards/{dashboardId}/pages/{pageId}`: rename, limit to teams, or both. */
export const ZV3PageUpdateBody = z
  .object({ name: ZV3DashboardPageName.optional(), teamIds: ZV3PageTeamIds.optional() })
  .strict()
  .superRefine(refuseEmptyPageUpdate);
export type TV3PageUpdateBody = z.infer<typeof ZV3PageUpdateBody>;

// ── Widgets ──────────────────────────────────────────────────────────────────────────────────

/**
 * The shape rules of a widget's `kind`, `chartId` and `content`, shared by the add, the save and MCP: a
 * chart names its chart and has no content; an image or text block has no chart and its content has the
 * block's shape; a separator has neither. Whether an image's file belongs to the workspace is the
 * operation's check (`parseWidgetContent`), answered 422.
 */
export const refuseWidgetKindMismatch = (
  widget: { kind?: string; chartId?: unknown; content?: unknown },
  ctx: z.RefinementCtx,
  path: (string | number)[] = []
): void => {
  const kind = widget.kind ?? "chart";
  if (kind === "chart") {
    if (widget.content !== undefined && widget.content !== null) {
      ctx.addIssue({ code: "custom", message: "A chart widget has no content.", path: [...path, "content"] });
    }
    return;
  }
  if (widget.chartId !== undefined) {
    ctx.addIssue({ code: "custom", message: `A ${kind} widget shows no chart.`, path: [...path, "chartId"] });
  }
  if (kind === "separator") {
    if (widget.content !== undefined && widget.content !== null) {
      ctx.addIssue({ code: "custom", message: "A separator has no content.", path: [...path, "content"] });
    }
    return;
  }
  if (widget.content === undefined) return;
  const parsed = (kind === "image" ? ZDashboardImageContent : ZDashboardTextContent).safeParse(
    widget.content
  );
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: [...path, "content", ...issue.path.map(String)],
      });
    }
  }
};

/** Content as a request carries it: checked against the widget's kind by `refuseWidgetKindMismatch`. */
const ZV3WidgetContentInput = z.record(z.string(), z.unknown()).nullable();

/**
 * `POST /api/v3/dashboards/{dashboardId}/widgets`: a chart (`chartId`) or a layout block (`kind` image,
 * text or separator, with `content` for image and text) on a page — the first page without `pageId` —
 * at `layout`, or the first open slot at the kind's default size.
 */
export const ZV3WidgetCreateBody = z
  .object({
    kind: ZDashboardWidgetKind.optional(),
    chartId: z.cuid2().optional(),
    pageId: z.cuid2().optional(),
    content: ZV3WidgetContentInput.optional(),
    layout: ZV3WidgetLayoutInput.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if ((body.kind ?? "chart") === "chart" && body.chartId === undefined) {
      ctx.addIssue({ code: "custom", message: "A chart widget needs a chartId.", path: ["chartId"] });
    }
    if (body.kind === "text" && (body.content === undefined || body.content === null)) {
      ctx.addIssue({ code: "custom", message: "A text block needs content.", path: ["content"] });
    }
    refuseWidgetKindMismatch(body, ctx);
  });
export type TV3WidgetCreateBody = z.infer<typeof ZV3WidgetCreateBody>;

/**
 * A widget update must change something: an empty one would still move the dashboard's `updatedAt`, and
 * every editor's next save would then be refused as stale. Shared with the MCP `update_widget` input.
 */
export const refuseEmptyWidgetUpdate = (
  body: { layout?: unknown; chartId?: unknown; content?: unknown; pageId?: unknown },
  ctx: z.RefinementCtx
): void => {
  if (
    body.layout === undefined &&
    body.chartId === undefined &&
    body.content === undefined &&
    body.pageId === undefined
  ) {
    ctx.addIssue({ code: "custom", message: "Send a layout, a chartId, content or a pageId." });
  }
};

/**
 * `PATCH /api/v3/dashboards/{dashboardId}/widgets/{widgetId}`: move it (on its page or to another),
 * repoint a chart widget, or replace a block's content.
 */
export const ZV3WidgetUpdateBody = z
  .object({
    layout: ZV3WidgetLayoutInput.optional(),
    chartId: z.cuid2().optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    pageId: z.cuid2().optional(),
  })
  .strict()
  .superRefine(refuseEmptyWidgetUpdate);
export type TV3WidgetUpdateBody = z.infer<typeof ZV3WidgetUpdateBody>;

/**
 * The most widgets a dashboard can grow to: an add or a copy onto a dashboard this full is refused (409).
 * Far past what a dashboard can usefully show.
 */
export const MAX_DASHBOARD_WIDGETS = 250;

/**
 * The most widgets a whole-dashboard write (save, rearrange) carries: a bound on the request, not the
 * dashboard. Such a write only keeps or removes widgets already there, never adds one, so a dashboard that
 * grew past `MAX_DASHBOARD_WIDGETS` before the cap existed can still be saved, and shrunk.
 */
export const MAX_WIDGETS_PER_WRITE = 1000;

/**
 * A widget's `order` is only a sort key. Adds take the highest one plus one and removals never renumber,
 * so a dashboard edited over time holds orders past its widget count; bounded by its integer column only,
 * so a dashboard read through the API can always be written back.
 */
export const MAX_WIDGET_ORDER = 2_147_483_647;

/**
 * `expectedUpdatedAt`: the dashboard's `updatedAt` from the caller's read, the write's precondition. Named as
 * the survey writes name it, so it never reads as a timestamp the caller sets; 409 if it changed since.
 */
const ZV3ExpectedDashboardUpdatedAt = z.iso.datetime({ offset: true });

/** A whole-dashboard write lists each widget once. Shared with the MCP `update_dashboard_layout` input. */
export const refuseRepeatedWidgets = (widgets: { widgetId?: string }[], ctx: z.RefinementCtx): void => {
  const seen = new Set<string>();
  widgets.forEach(({ widgetId }, index) => {
    if (widgetId === undefined) return;
    if (seen.has(widgetId)) {
      ctx.addIssue({ code: "custom", message: "Each widget may appear once.", path: ["widgets", index] });
    }
    seen.add(widgetId);
  });
};

/**
 * The checks a list of locked filters must pass beyond each filter's own shape: each a catalog dimension
 * or an embedded-data field with an operator it allows, ids unique, and all their values within the budget
 * a read's picks have. Every problem is named at its position. Shared with the MCP `set_dashboard_filters`
 * input.
 */
export const refuseInvalidDashboardFilters = (
  filters: readonly TLockedDashboardFilter[],
  ctx: z.RefinementCtx
): void => {
  // The cap is the array's own `max`; only the per-filter problems are added here.
  for (const issue of findDashboardFilterIssues(filters)) {
    if (issue.path.length > 0) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
  const picks = Object.fromEntries(filters.map((filter) => [filter.id, filter.values]));
  for (const issue of findPickIssues(filters, picks)) {
    const index = filters.findIndex((filter) => `picks[${filter.id}]` === issue.name);
    ctx.addIssue({ code: "custom", message: issue.reason, path: index >= 0 ? [index, "values"] : [] });
  }
};

/** A dashboard's locked filters as a write sends them: at most `MAX_DASHBOARD_FILTERS`, each checked as above. */
export const ZV3DashboardFilters = z
  .array(ZLockedDashboardFilter)
  .max(MAX_DASHBOARD_FILTERS)
  .superRefine(refuseInvalidDashboardFilters);

/** A new page's key in a save: how the save's widgets name a page that does not exist yet. */
export const ZV3NewPageKey = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * A page in a whole-dashboard save: an existing one by `pageId`, or a new one by a `key` of the caller's
 * choosing. `teamIds` is kept as it is when omitted; a new page without it is open to all teams.
 */
const ZV3ReplacePage = z
  .object({
    pageId: z.cuid2().optional(),
    key: ZV3NewPageKey.optional(),
    name: ZV3DashboardPageName,
    order: z.number().int().min(0).max(MAX_WIDGET_ORDER),
    teamIds: ZV3PageTeamIds.optional(),
  })
  .strict();

/**
 * A widget in a whole-dashboard save: an existing one by `widgetId`, or — without one — a new widget of
 * `kind` (a chart with its `chartId`, or a layout block). `pageId` (an existing page) or `pageKey` (a new
 * page of the save) puts it on a page; an existing widget sent without either stays on its page, a new one
 * goes on the first page. `content` replaces an image or text block's content.
 */
const ZV3ReplaceWidget = z
  .object({
    widgetId: z.cuid2().optional(),
    kind: ZDashboardWidgetKind.optional(),
    chartId: z.cuid2().optional(),
    pageId: z.cuid2().optional(),
    pageKey: ZV3NewPageKey.optional(),
    content: ZV3WidgetContentInput.optional(),
    layout: ZV3WidgetLayoutInput,
    order: z.number().int().min(0).max(MAX_WIDGET_ORDER),
  })
  .strict();

type TReplaceShape = {
  pages?: { pageId?: string; key?: string }[];
  widgets: {
    widgetId?: string;
    kind?: string;
    chartId?: string;
    pageId?: string;
    pageKey?: string;
    content?: unknown;
  }[];
};

/** Each page of a save is an existing one or a new one, and appears once. */
const refuseInvalidReplacePages = (pages: TReplaceShape["pages"], ctx: z.RefinementCtx): Set<string> => {
  const keys = new Set<string>();
  const pageIds = new Set<string>();
  pages?.forEach((page, index) => {
    if ((page.pageId === undefined) === (page.key === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Send pageId for an existing page or key for a new one, not both.",
        path: ["pages", index],
      });
    }
    const [seen, value] = page.pageId === undefined ? [keys, page.key] : [pageIds, page.pageId];
    if (value === undefined) return;
    if (seen.has(value)) {
      ctx.addIssue({ code: "custom", message: "Each page may appear once.", path: ["pages", index] });
    }
    seen.add(value);
  });
  return keys;
};

/**
 * The cross-field rules of a save: each page is an existing one or a new one, named once; each widget is
 * an existing one (which keeps its chart — repoint it with the widget update) or a new one with its kind's
 * fields; a `pageKey` names a new page of the same save.
 */
export const refuseInvalidReplaceShape = (body: TReplaceShape, ctx: z.RefinementCtx): void => {
  const keys = refuseInvalidReplacePages(body.pages, ctx);

  body.widgets.forEach((widget, index) => {
    const path = ["widgets", index];
    if (widget.pageId !== undefined && widget.pageKey !== undefined) {
      ctx.addIssue({ code: "custom", message: "Send pageId or pageKey, not both.", path });
    }
    if (widget.pageKey !== undefined && !keys.has(widget.pageKey)) {
      ctx.addIssue({
        code: "custom",
        message: "pageKey must name a new page of this save.",
        path: [...path, "pageKey"],
      });
    }
    if (widget.widgetId !== undefined) {
      if (widget.chartId !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "An existing widget keeps its chart; repoint it with the widget update.",
          path: [...path, "chartId"],
        });
      }
      // An existing widget's kind is checked against the stored one, its content against that kind.
      if (widget.kind !== undefined) refuseWidgetKindMismatch(widget, ctx, path);
      return;
    }
    if (widget.kind === undefined) {
      ctx.addIssue({ code: "custom", message: "A new widget needs a kind.", path: [...path, "kind"] });
      return;
    }
    if (widget.kind === "chart" && widget.chartId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "A chart widget needs a chartId.",
        path: [...path, "chartId"],
      });
    }
    if (widget.kind === "text" && (widget.content === undefined || widget.content === null)) {
      ctx.addIssue({ code: "custom", message: "A text block needs content.", path: [...path, "content"] });
    }
    refuseWidgetKindMismatch(widget, ctx, path);
  });
};

/**
 * `PUT /api/v3/dashboards/{dashboardId}`: the name, every widget's place and, optionally, the filters and
 * the pages, in one write. A widget left out of `widgets` is removed — this is the app's save, which sends
 * the whole edited dashboard — and so is a page left out of `pages`, with its widgets. Without `filters`
 * or `pages` the saved ones stay as they are. New pages and new widgets are created by the same write.
 */
export const ZV3DashboardReplaceBody = z
  .object({
    name: ZV3DashboardName,
    expectedUpdatedAt: ZV3ExpectedDashboardUpdatedAt,
    filters: ZV3DashboardFilters.optional(),
    pages: z.array(ZV3ReplacePage).min(1).max(MAX_DASHBOARD_PAGES).optional(),
    widgets: z.array(ZV3ReplaceWidget).max(MAX_WIDGETS_PER_WRITE),
  })
  .strict()
  .superRefine((body, ctx) => {
    refuseRepeatedWidgets(body.widgets, ctx);
    refuseInvalidReplaceShape(body, ctx);
  });
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
      .max(MAX_WIDGETS_PER_WRITE),
  })
  .strict()
  .superRefine((body, ctx) => refuseRepeatedWidgets(body.widgets, ctx));
export type TV3DashboardLayoutBody = z.infer<typeof ZV3DashboardLayoutBody>;

/**
 * What `setV3DashboardFilters` takes: the dashboard's locked filters, all of them, replacing the saved ones
 * (an empty list removes them all), and nothing else. The MCP `set_dashboard_filters` input; over HTTP the
 * same write is `PUT /api/v3/dashboards/{dashboardId}` with `filters`.
 */
export const ZV3DashboardFiltersBody = z
  .object({ expectedUpdatedAt: ZV3ExpectedDashboardUpdatedAt, filters: ZV3DashboardFilters })
  .strict();
export type TV3DashboardFiltersBody = z.infer<typeof ZV3DashboardFiltersBody>;

/** `GET /api/v3/dashboards/{dashboardId}/charts/{chartId}/data`. */
export const ZV3DashboardChartParams = z.object({ dashboardId: z.cuid2(), chartId: z.cuid2() }).strict();

/** `GET /api/v3/dashboards/{dashboardId}/filters/{filterId}/values`: `filterId` names a `filter[<id>]` of the query. */
export const ZV3DashboardFilterParams = z
  .object({ dashboardId: z.cuid2(), filterId: z.string().regex(FILTER_RULE_ID) })
  .strict();

const ZV3PickValue = zPostgresText().max(MAX_DASHBOARD_FILTER_PICK_VALUE_LENGTH);

/**
 * The filters of a read, sent as `filter[<id>]=<operator>:<field>`: the dashboard keeps no list of them, so
 * every read names the ones its picks are for. The field and operator are checked by the operations
 * (`resolveFilterRules`), which name the parameter at fault. At most `MAX_DASHBOARD_FILTERS`.
 */
export const ZDashboardFilterRules = z
  .record(z.string().regex(FILTER_RULE_ID), z.string().min(3).max(300))
  .refine((rules) => Object.keys(rules).length <= MAX_DASHBOARD_FILTERS, {
    message: `At most ${MAX_DASHBOARD_FILTERS} filters can be applied.`,
  });

/**
 * A person's dashboard filter picks, sent as `picks[<filterId>]=value`, repeated for several values. Picks
 * for a filter the dashboard does not have are ignored, as the page drops them. THE picks schema: the v3
 * routes and the MCP tools both take picks through it (C15). The total size is checked by the operations
 * (`MAX_DASHBOARD_FILTER_PICKS_CHARS`, 422), so both answer it the same way.
 */
export const ZDashboardFilterPicks = z
  .record(
    z.string().regex(FILTER_RULE_ID),
    z.array(ZV3PickValue).min(1).max(MAX_DASHBOARD_FILTER_PICK_VALUES)
  )
  .refine((picks) => Object.keys(picks).length <= MAX_DASHBOARD_FILTERS, {
    message: `At most ${MAX_DASHBOARD_FILTERS} filters can be picked.`,
  });

/** The dashboard date range, as the chart data route takes it: `dateRange`, or `from` and `to`. */
const dashboardDateRange = {
  dateRange: z.string().min(1).max(64).optional(),
  from: z.string().min(1).max(32).optional(),
  to: z.string().min(1).max(32).optional(),
};

/** The date range and the picks a dashboard-bound chart read is narrowed by. */
export const ZV3DashboardChartDataQuery = z.preprocess(
  splitPickParams,
  z
    .object({
      ...dashboardDateRange,
      ...viewAsParam,
      rules: ZDashboardFilterRules.optional(),
      picks: ZDashboardFilterPicks.optional(),
    })
    .strict()
);
export type TV3DashboardChartDataQuery = z.infer<typeof ZV3DashboardChartDataQuery>;

/** A filter's value list: narrowed like the charts, and by a case-insensitive `search`. */
export const ZV3DashboardFilterValuesQuery = z.preprocess(
  splitPickParams,
  z
    .object({
      ...dashboardDateRange,
      ...viewAsParam,
      rules: ZDashboardFilterRules.optional(),
      picks: ZDashboardFilterPicks.optional(),
      search: zPostgresText().trim().min(1).max(V3_NAME_MAX_LENGTH).optional(),
    })
    .strict()
);
export type TV3DashboardFilterValuesQuery = z.infer<typeof ZV3DashboardFilterValuesQuery>;
