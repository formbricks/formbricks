import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getV3FeedbackFieldCatalog, queryV3Feedback } from "@/app/api/v3/feedback-queries/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  type TMcpGetFeedbackFieldCatalogInput,
  type TMcpQueryFeedbackInput,
  ZMcpGetFeedbackFieldCatalogInput,
  ZMcpQueryFeedbackInput,
} from "./feedback-query-schemas";
import { registerScopedTool } from "./guard-scopes";
import { mcpToolOutput } from "./output-schemas";

const ZMcpFeedbackQueryOutput = mcpToolOutput(
  z.object({
    datasetId: z.string(),
    datasetName: z.string(),
    query: z.object({}).loose(),
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  })
);

const ZMcpFieldCatalogOutput = mcpToolOutput(
  z
    .object({
      measures: z.array(z.object({}).loose()),
      dimensions: z.array(z.object({}).loose()),
    })
    .loose()
);

const FEEDBACK_QUERY_SCOPE: [string, ...string[]] = ["feedbackRecords:read"];

/**
 * Read-only analytics over a Feedback Dataset (ADR 0016). Both tools sit on `feedbackRecords:read`, like
 * the record reads they complement: a query returns aggregates of the same records. The operations resolve
 * the dataset, check the licence and apply the rate limit; nothing here does.
 */
export function registerFeedbackQueryTools(server: McpServer): void {
  registerScopedTool(
    server,
    "get_feedback_field_catalog",
    {
      title: "Get feedback field catalog",
      description:
        "List the measures, dimensions, filter operators, time granularities, date presets and limits a feedback query may use. Call this before query_feedback: a query naming a field outside the catalog is rejected.",
      inputSchema: ZMcpGetFeedbackFieldCatalogInput,
      outputSchema: ZMcpFieldCatalogOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    FEEDBACK_QUERY_SCOPE,
    async (input: TMcpGetFeedbackFieldCatalogInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3FeedbackFieldCatalog({
        workspaceId: input.workspaceId,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "query_feedback",
    {
      title: "Query feedback",
      description:
        "Aggregate a workspace's feedback dataset: compute measures such as NPS, CSAT or counts, grouped by dimensions such as question, sentiment or source, filtered and bucketed over time. Returns rows keyed by field id, plus the query that ran (a default limit of 100 is applied when none is given). Read-only; use list_feedback_records to read individual records. Fields come from get_feedback_field_catalog. Scores such as npsScore are null, not zero, for a group with no answers to score.",
      inputSchema: ZMcpQueryFeedbackInput,
      outputSchema: ZMcpFeedbackQueryOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    FEEDBACK_QUERY_SCOPE,
    async (input: TMcpQueryFeedbackInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await queryV3Feedback({
        workspaceId: input.workspaceId,
        datasetId: input.datasetId,
        query: input.query,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
