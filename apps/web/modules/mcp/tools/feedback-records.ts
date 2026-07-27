import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "@formbricks/logger";
import {
  createV3FeedbackRecord,
  deleteV3FeedbackRecord,
  findSimilarV3FeedbackRecords,
  getV3FeedbackRecord,
  listV3FeedbackDatasets,
  listV3FeedbackRecords,
  searchV3FeedbackRecords,
} from "@/app/api/v3/feedbackRecords/lib/operations";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { guardMcpScopes } from "./guard-scopes";
import {
  type TMcpCreateFeedbackRecordInput,
  type TMcpDeleteFeedbackRecordInput,
  type TMcpFindSimilarFeedbackRecordsInput,
  type TMcpGetFeedbackRecordInput,
  type TMcpListFeedbackDatasetsInput,
  type TMcpListFeedbackRecordsInput,
  type TMcpSearchFeedbackRecordsInput,
  ZMcpCreateFeedbackRecordInput,
  ZMcpDeleteFeedbackRecordInput,
  ZMcpFindSimilarFeedbackRecordsInput,
  ZMcpGetFeedbackRecordInput,
  ZMcpListFeedbackDatasetsInput,
  ZMcpListFeedbackRecordsInput,
  ZMcpSearchFeedbackRecordsInput,
} from "./schemas";

const FEEDBACK_RECORDS_READ_SCOPE = ["feedbackRecords:read"];
const FEEDBACK_RECORDS_WRITE_SCOPE = ["feedbackRecords:write"];

/**
 * Shared handler body for the read-only tools: resolve the request id, gate on the read scope, run the
 * v3 operation, map its Response to a tool result. Only `run` differs between them.
 */
function readOnlyHandler<TInput>(
  run: (input: TInput, authentication: TV3Authentication, requestId: string) => Promise<Response>
) {
  return async (input: TInput, extra: { authInfo?: AuthInfo }): Promise<CallToolResult> => {
    const requestId = getMcpRequestId(extra.authInfo);
    const scopeError = await guardMcpScopes(extra.authInfo, FEEDBACK_RECORDS_READ_SCOPE, requestId);
    if (scopeError) {
      return scopeError;
    }

    const response = await run(input, getMcpAuthentication(extra.authInfo), requestId);
    return await responseToMcpToolResult(response, requestId);
  };
}

/**
 * Shared handler body for the mutating tools: write scope, plus the audit-log lifecycle — the record is
 * stamped by the operation, and the outcome (`success`, or an `eventId` on failure) by this wrapper. A
 * throw still queues the log, so a failed mutation is never silently unaudited.
 */
function writeHandler<TInput extends { workspaceId: string }>(
  action: "created" | "deleted",
  run: (
    input: TInput,
    authentication: TV3Authentication,
    requestId: string,
    auditLog?: TV3AuditLog
  ) => Promise<Response>
) {
  return async (input: TInput, extra: { authInfo?: AuthInfo }): Promise<CallToolResult> => {
    const requestId = getMcpRequestId(extra.authInfo);
    const scopeError = await guardMcpScopes(extra.authInfo, FEEDBACK_RECORDS_WRITE_SCOPE, requestId);
    if (scopeError) {
      return scopeError;
    }

    const authentication = getMcpAuthentication(extra.authInfo);
    const log = logger.withContext({ requestId, workspaceId: input.workspaceId });
    const auditLog = buildV3AuditLog(authentication, action, "feedbackRecord", MCP_API_ROUTE);

    try {
      const response = await run(input, authentication, requestId, auditLog);

      if (auditLog) {
        if (response.ok) {
          auditLog.status = "success";
        } else {
          auditLog.eventId = requestId;
        }
      }

      await queueV3AuditLog(auditLog, requestId, log);
      return await responseToMcpToolResult(response, requestId);
    } catch (error) {
      if (auditLog) {
        auditLog.eventId = requestId;
        await queueV3AuditLog(auditLog, requestId, log);
      }

      throw error;
    }
  };
}

export function registerFeedbackRecordTools(server: McpServer): void {
  server.registerTool(
    "list_feedback_datasets",
    {
      title: "List feedback datasets",
      description:
        "List the feedback datasets assigned to a Formbricks workspace. Use the returned id as datasetId for the other feedback-record tools.",
      inputSchema: ZMcpListFeedbackDatasetsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    readOnlyHandler<TMcpListFeedbackDatasetsInput>((input, authentication, requestId) =>
      listV3FeedbackDatasets({
        workspaceId: input.workspaceId,
        authentication,
        requestId,
        instance: MCP_API_ROUTE,
      })
    )
  );

  server.registerTool(
    "list_feedback_records",
    {
      title: "List feedback records",
      description:
        "List feedback records for a workspace's feedback dataset, with cursor pagination and optional filters. meta.datasetId and meta.datasetName report which dataset was searched, so an empty data array means that dataset holds no matching records — there is no need to call list_feedback_datasets to check. A workspace with no dataset at all fails with 422 instead.",
      inputSchema: ZMcpListFeedbackRecordsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    readOnlyHandler<TMcpListFeedbackRecordsInput>((input, authentication, requestId) =>
      listV3FeedbackRecords({
        workspaceId: input.workspaceId,
        datasetId: input.datasetId,
        limit: input.limit,
        cursor: input.cursor,
        sourceType: input.sourceType,
        fieldType: input.fieldType,
        since: input.since,
        until: input.until,
        authentication,
        requestId,
        instance: MCP_API_ROUTE,
      })
    )
  );

  server.registerTool(
    "get_feedback_record",
    {
      title: "Get feedback record",
      description: "Get one feedback record by id from a workspace's feedback dataset.",
      inputSchema: ZMcpGetFeedbackRecordInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    readOnlyHandler<TMcpGetFeedbackRecordInput>((input, authentication, requestId) =>
      getV3FeedbackRecord({
        workspaceId: input.workspaceId,
        feedbackRecordId: input.feedbackRecordId,
        datasetId: input.datasetId,
        authentication,
        requestId,
        instance: MCP_API_ROUTE,
      })
    )
  );

  server.registerTool(
    "create_feedback_record",
    {
      title: "Create feedback record",
      description:
        "Create a feedback record in a workspace's feedback dataset. The dataset is resolved from workspaceId, or from datasetId when the workspace has more than one; it can never be set through the record body.",
      inputSchema: ZMcpCreateFeedbackRecordInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    writeHandler<TMcpCreateFeedbackRecordInput>("created", (input, authentication, requestId, auditLog) =>
      createV3FeedbackRecord({
        workspaceId: input.workspaceId,
        datasetId: input.datasetId,
        body: input,
        authentication,
        requestId,
        instance: MCP_API_ROUTE,
        auditLog,
      })
    )
  );

  server.registerTool(
    "delete_feedback_record",
    {
      title: "Delete feedback record",
      description:
        "Permanently delete one feedback record from a workspace's feedback dataset. This cannot be undone: the record and its search embedding are removed, and no copy is kept. Deletes a single record only — there is no bulk delete. Returns no content on success.",
      inputSchema: ZMcpDeleteFeedbackRecordInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    writeHandler<TMcpDeleteFeedbackRecordInput>("deleted", (input, authentication, requestId, auditLog) =>
      deleteV3FeedbackRecord({
        workspaceId: input.workspaceId,
        feedbackRecordId: input.feedbackRecordId,
        datasetId: input.datasetId,
        authentication,
        requestId,
        instance: MCP_API_ROUTE,
        auditLog,
      })
    )
  );

  server.registerTool(
    "search_feedback_records",
    {
      title: "Search feedback records",
      description:
        "Search a workspace's feedback dataset by meaning rather than keywords: the query is embedded and compared to record embeddings, so 'checkout is confusing' also matches 'I couldn't figure out how to pay'. Returns scored matches, best first — record ids with the matched text, not full records; pass an id to get_feedback_record for the rest. Only records with text are searchable, and embeddings are generated in the background, so a record created moments ago may not appear yet. Requires an embedding model on the feedback service; without one this fails with 503.",
      inputSchema: ZMcpSearchFeedbackRecordsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    readOnlyHandler<TMcpSearchFeedbackRecordsInput>((input, authentication, requestId) =>
      searchV3FeedbackRecords({
        workspaceId: input.workspaceId,
        datasetId: input.datasetId,
        query: input.query,
        limit: input.limit,
        cursor: input.cursor,
        minScore: input.minScore,
        authentication,
        requestId,
        instance: MCP_API_ROUTE,
      })
    )
  );

  server.registerTool(
    "find_similar_feedback_records",
    {
      title: "Find similar feedback records",
      description:
        "Find the feedback records most similar to a given one — use it to see how widely a piece of feedback is echoed by others. Returns scored matches, best first, excluding the record itself. If the record has no embedding yet (embeddings are generated in the background, and records without text are never embedded) this reports a retryable conflict rather than an empty result. Requires an embedding model on the feedback service; without one this fails with 503.",
      inputSchema: ZMcpFindSimilarFeedbackRecordsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    readOnlyHandler<TMcpFindSimilarFeedbackRecordsInput>((input, authentication, requestId) =>
      findSimilarV3FeedbackRecords({
        workspaceId: input.workspaceId,
        feedbackRecordId: input.feedbackRecordId,
        datasetId: input.datasetId,
        limit: input.limit,
        cursor: input.cursor,
        minScore: input.minScore,
        authentication,
        requestId,
        instance: MCP_API_ROUTE,
      })
    )
  );
}
