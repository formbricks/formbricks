import { z } from "zod";

// ── Cube.js Query shape (stored as JSON in Chart.query) ─────────────────────
// Mirrors https://cube.dev/docs/product/apis-integrations/core-data-apis/rest-api/query-format

const ZCubeTimeDimension = z.object({
  dimension: z.string(),
  dateRange: z.union([z.string(), z.tuple([z.string(), z.string()])]).optional(),
  compareDateRange: z.array(z.union([z.string(), z.tuple([z.string(), z.string()])])).optional(),
  granularity: z.enum(["second", "minute", "hour", "day", "week", "month", "quarter", "year"]).optional(),
});

export type TTimeDimension = z.infer<typeof ZCubeTimeDimension>;

const ZCubeMemberFilter = z.object({
  member: z.string(),
  operator: z.string(),
  values: z.array(z.string()).optional(),
});

export type TMemberFilter = z.infer<typeof ZCubeMemberFilter>;

export type TCubeFilter = TMemberFilter | { and: TCubeFilter[] } | { or: TCubeFilter[] };

const ZCubeLogicalFilter: z.ZodType<TCubeFilter> = z.union([
  ZCubeMemberFilter,
  z.object({ and: z.array(z.lazy(() => ZCubeLogicalFilter)) }),
  z.object({ or: z.array(z.lazy(() => ZCubeLogicalFilter)) }),
]);

export const ZChartQuery = z.object({
  measures: z.array(z.string()).optional(),
  dimensions: z.array(z.string()).optional(),
  segments: z.array(z.string()).optional(),
  timeDimensions: z.array(ZCubeTimeDimension).optional(),
  filters: z.array(ZCubeLogicalFilter).optional(),
  order: z
    .union([
      z.array(z.tuple([z.string(), z.enum(["asc", "desc"])])),
      z.record(z.string(), z.enum(["asc", "desc"])),
    ])
    .optional(),
  limit: z.number().int().positive().optional(),
  total: z.boolean().optional(),
  offset: z.number().int().nonnegative().optional(),
  timezone: z.string().optional(),
  renewQuery: z.boolean().optional(),
  ungrouped: z.boolean().optional(),
  joinHints: z.array(z.tuple([z.string(), z.string()])).optional(),
});

export type TChartQuery = z.infer<typeof ZChartQuery>;

// ── Chart visualization config (stored as JSON in Chart.config) ─────────────

export const ZChartConfig = z.object({
  /** Bar charts only: bars run up from the category axis ("vertical", default) or across it. */
  barOrientation: z.enum(["vertical", "horizontal"]).optional(),
  /** Pie charts only: the classic pie ("pie", default) or one bar split by share ("breakdown"). */
  pieDisplay: z.enum(["pie", "breakdown"]).optional(),
  /** Area charts only: a solid band under the stroke ("filled", default) or a line with a soft fade ("line"). */
  areaDisplay: z.enum(["filled", "line"]).optional(),
  /** Matrix charts only: what each cell prints — share of its row ("percent", default), the raw "count", or "both". */
  matrixCellValue: z.enum(["percent", "count", "both"]).optional(),
  /** Matrix charts only: tint cells by value (default true). */
  matrixColorScale: z.boolean().optional(),
  /** Matrix charts only: add a total column and a total row (default false). */
  matrixShowTotals: z.boolean().optional(),
  /** Matrix charts only: swap rows and columns on screen. The query is unchanged (default false). */
  matrixTranspose: z.boolean().optional(),
  colors: z.array(z.string()).optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  showLegend: z.boolean().optional(),
  legendPosition: z.enum(["top", "bottom", "left", "right"]).optional(),
  /** Bar charts with several series: stack them into one bar per category (default true) or place them side by side. */
  stacked: z.boolean().optional(),
  /** Grouped charts: show records with no value for a grouping as their own "(no value)" group (default false, hidden). */
  showEmptyValues: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  showValues: z.boolean().optional(),
  numberFormat: z.string().optional(),
  dateFormat: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

export type TChartConfig = z.infer<typeof ZChartConfig>;

// ── Widget grid layout (stored as JSON in DashboardWidget.layout) ───────────

export const ZWidgetLayout = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export type TWidgetLayout = z.infer<typeof ZWidgetLayout>;

// ── Dashboard widget kinds and layout-block content (ENG-7467, ENG-7249–7251) ───────────

export const ZDashboardWidgetKind = z.enum(["chart", "image", "text", "separator"]);
export type TDashboardWidgetKind = z.infer<typeof ZDashboardWidgetKind>;

/** Longest text a text block's headline may hold. */
export const MAX_TEXT_BLOCK_HEADLINE_LENGTH = 200;
/** Longest text a text block's description may hold, line breaks included. */
export const MAX_TEXT_BLOCK_DESCRIPTION_LENGTH = 2000;
/** Longest alt text an image block may hold. */
export const MAX_IMAGE_BLOCK_ALT_LENGTH = 300;
/** Longest storage URL an image block may hold. */
export const MAX_IMAGE_BLOCK_URL_LENGTH = 2048;

/**
 * An image block's content. `fileUrl` is a private storage URL (`/storage/<workspaceId>/private/...`),
 * served only to callers who can open the page the block sits on (ENG-7482). Null while the block is empty.
 */
export const ZDashboardImageContent = z
  .object({
    fileUrl: z.string().max(MAX_IMAGE_BLOCK_URL_LENGTH).nullable(),
    fit: z.enum(["fit", "fill"]),
    position: z.enum(["left", "center", "right"]),
    alt: z.string().max(MAX_IMAGE_BLOCK_ALT_LENGTH),
  })
  .strict();
export type TDashboardImageContent = z.infer<typeof ZDashboardImageContent>;

/** A text block's content: plain text only. Either part may be empty, but not both. */
export const ZDashboardTextContent = z
  .object({
    headline: z.string().max(MAX_TEXT_BLOCK_HEADLINE_LENGTH),
    description: z.string().max(MAX_TEXT_BLOCK_DESCRIPTION_LENGTH),
  })
  .strict()
  .refine((content) => content.headline.trim().length > 0 || content.description.trim().length > 0, {
    message: "A text block needs a headline or a description.",
  });
export type TDashboardTextContent = z.infer<typeof ZDashboardTextContent>;

export type TDashboardWidgetContent = TDashboardImageContent | TDashboardTextContent;
