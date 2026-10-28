import { z } from "zod";

// ── Cube.js Query shape (accepted by POST /api/v3/feedback-queries) ──────────
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

export const ZCubeQuery = z.object({
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

export type TCubeQuery = z.infer<typeof ZCubeQuery>;
