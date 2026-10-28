import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { queryV3Feedback } from "@/app/api/v3/feedback-queries/lib/operations";
import { problemBadRequest, problemInternalError } from "@/app/api/v3/lib/response";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../../auth";
import { responseToMcpToolResult } from "../../errors";
import { ZMcpQueryFeedbackInput } from "../../tools/feedback-query-schemas";
import { buildChartSummary, isTruncated, projectRows } from "./chart-result";
import { ZMcpFeedbackChartHint, resolveFeedbackChart } from "./chart-spec";
import type { TMcpShowFeedbackChartOutput } from "./output-schema";

/**
 * The same input as `query_feedback`, plus the optional drawing hint. The query half is that tool's own
 * schema, spread rather than restated, so the two can never accept different queries.
 */
export const ZMcpShowFeedbackChartInput = z.strictObject({
  ...ZMcpQueryFeedbackInput.shape,
  chart: ZMcpFeedbackChartHint.optional(),
});
export type TMcpShowFeedbackChartInput = z.infer<typeof ZMcpShowFeedbackChartInput>;

const ZCell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** What `queryV3Feedback` answers on success; read defensively because the view trusts what it is given. */
const ZQueryBody = z.object({
  data: z.object({
    datasetId: z.string(),
    datasetName: z.string(),
    query: z.object({ limit: z.number().optional() }).loose(),
    rows: z.array(z.record(z.string(), ZCell)),
  }),
});

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * `show_feedback_chart`: runs the query through `queryV3Feedback`, the operation behind `query_feedback`
 * and `POST /api/v3/feedback-queries`, so the licence gate, rate limit, row limit and tenant isolation are
 * that operation's and not repeated here. This function only decides how to draw the rows it returns.
 *
 * The hint is checked first: a hint that cannot be drawn is refused before the analytics service is asked
 * anything.
 */
export async function showFeedbackChart(
  input: TMcpShowFeedbackChartInput,
  mcpCtx: TMcpToolContext
): Promise<CallToolResult> {
  const authInfo = getMcpToolAuthInfo(mcpCtx);
  const requestId = getMcpRequestId(authInfo);

  const resolved = resolveFeedbackChart(input.query, input.chart);
  if (!resolved.ok) {
    return await responseToMcpToolResult(
      problemBadRequest(requestId, resolved.detail, {
        invalid_params: resolved.invalidParams,
        instance: MCP_API_ROUTE,
      }),
      requestId
    );
  }

  const response = await queryV3Feedback({
    workspaceId: input.workspaceId,
    datasetId: input.datasetId,
    query: input.query,
    authentication: getMcpAuthentication(authInfo),
    requestId,
    instance: MCP_API_ROUTE,
  });
  if (!response.ok) {
    return await responseToMcpToolResult(response, requestId);
  }

  const body = ZQueryBody.safeParse(await readBody(response));
  if (!body.success) {
    return await responseToMcpToolResult(
      problemInternalError(requestId, "The query result could not be read.", MCP_API_ROUTE),
      requestId
    );
  }

  const { data } = body.data;
  const rows = projectRows(data.rows, resolved.columns);
  const truncated = isTruncated(rows.length, data.query);

  const structuredContent: TMcpShowFeedbackChartOutput = {
    datasetId: data.datasetId,
    datasetName: data.datasetName,
    query: data.query,
    chart: resolved.spec,
    columns: resolved.columns,
    rows,
    truncated,
    requestId,
  };

  return {
    structuredContent,
    content: [
      {
        type: "text",
        text: buildChartSummary({
          spec: resolved.spec,
          columns: resolved.columns,
          rows,
          truncated,
          datasetName: data.datasetName,
        }),
      },
    ],
  };
}
