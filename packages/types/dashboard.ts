import { z } from "zod";

// ── Cube.js Query shape (stored as JSON in Chart.query) ─────────────────────
// Mirrors https://cube.dev/docs/product/apis-integrations/core-data-apis/rest-api/query-format

const ZCubeTimeDimension = z.object({
  dimension: z.string(),
  dateRange: z.union([z.string(), z.tuple([z.string(), z.string()])]).optional(),
  compareDateRange: z.array(z.union([z.string(), z.tuple([z.string(), z.string()])])).optional(),
  granularity: z.enum(["second", "minute", "hour", "day", "week", "month", "quarter", "year"]).optional(),
});

const ZCubeMemberFilter = z.object({
  member: z.string(),
  operator: z.string(),
  values: z.array(z.string()).optional(),
});

type TCubeFilter = z.infer<typeof ZCubeMemberFilter> | { and: TCubeFilter[] } | { or: TCubeFilter[] };

const ZCubeFilter: z.ZodType<TCubeFilter> = z.union([
  ZCubeMemberFilter,
  z.object({ and: z.lazy(() => z.array(ZCubeFilter)) }),
  z.object({ or: z.lazy(() => z.array(ZCubeFilter)) }),
]);

export const ZChartQuery = z.object({
  measures: z.array(z.string()).optional(),
  dimensions: z.array(z.string()).optional(),
  segments: z.array(z.string()).optional(),
  timeDimensions: z.array(ZCubeTimeDimension).optional(),
  filters: z.array(ZCubeFilter).optional(),
  order: z
    .union([z.array(z.tuple([z.string(), z.enum(["asc", "desc"])])), z.record(z.enum(["asc", "desc"]))])
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
  colors: z.array(z.string()).optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  showLegend: z.boolean().optional(),
  legendPosition: z.enum(["top", "bottom", "left", "right"]).optional(),
  stacked: z.boolean().optional(),
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
