import { z } from "zod";
import { TIME_GRANULARITIES } from "@/modules/ee/analysis/lib/schema-definition";
import { ZMcpToolError } from "../../tools/output-schemas";
import { FEEDBACK_CHART_TYPES } from "./chart-spec";

const ZChartColumn = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["time", "dimension", "measure"]),
  domain: z.tuple([z.number(), z.number()]).optional(),
});

const ZChartSpec = z.strictObject({
  type: z.enum(FEEDBACK_CHART_TYPES),
  title: z.string(),
  x: z.string().optional(),
  xKind: z.enum(["time", "category"]).optional(),
  granularity: z.enum(TIME_GRANULARITIES).optional(),
  y: z.array(z.string()),
  series: z.string().optional(),
  omittedMeasures: z.array(z.string()).optional(),
});

/**
 * `structuredContent` of `show_feedback_chart`: what the view draws and what a model can read.
 *
 * One object root with every success field optional and an `error` branch, like `mcpToolOutput` builds,
 * for the same reason: a union would become a root-level `anyOf`. It is flat rather than wrapped in
 * `data` because the view reads it directly and a model reads it as the chart's own record.
 */
export const ZMcpShowFeedbackChartOutput = z
  .object({
    datasetId: z.string().optional(),
    datasetName: z.string().optional(),
    /** The query that ran, limit included. */
    query: z.object({}).loose().optional(),
    chart: ZChartSpec.optional(),
    columns: z.array(ZChartColumn).optional(),
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional(),
    truncated: z.boolean().optional(),
    requestId: z.string().optional(),
    error: ZMcpToolError.optional(),
  })
  .strict();

export type TMcpShowFeedbackChartOutput = z.infer<typeof ZMcpShowFeedbackChartOutput>;
