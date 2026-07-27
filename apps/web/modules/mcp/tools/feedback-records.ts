import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "@formbricks/logger";
import {
  createV3FeedbackRecord,
  getV3FeedbackRecord,
  listV3FeedbackDatasets,
  listV3FeedbackRecords,
} from "@/app/api/v3/feedbackRecords/lib/operations";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { guardMcpScopes } from "./guard-scopes";
import {
  type TMcpCreateFeedbackRecordInput,
  type TMcpGetFeedbackRecordInput,
  type TMcpListFeedbackDatasetsInput,
  type TMcpListFeedbackRecordsInput,
  ZMcpCreateFeedbackRecordInput,
  ZMcpGetFeedbackRecordInput,
  ZMcpListFeedbackDatasetsInput,
  ZMcpListFeedbackRecordsInput,
} from "./schemas";

const FEEDBACK_RECORDS_READ_SCOPE = ["feedbackRecords:read"];
const FEEDBACK_RECORDS_WRITE_SCOPE = ["feedbackRecords:write"];

/**
 * Shared handler body for the read-only tools: resolve the request id, gate on the read scope, run the
 * v3 operation, map its Response to a tool result. Only `run` differs between them; `create` keeps its
 * own handler because of the audit-log lifecycle.
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
        "List feedback records for a workspace's feedback dataset, with cursor pagination and optional filters.",
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
        "Create a feedback record in a workspace's feedback dataset. The dataset is derived from the workspace; it is never taken from input.",
      inputSchema: ZMcpCreateFeedbackRecordInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpCreateFeedbackRecordInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const scopeError = await guardMcpScopes(extra.authInfo, FEEDBACK_RECORDS_WRITE_SCOPE, requestId);
      if (scopeError) {
        return scopeError;
      }

      const authentication = getMcpAuthentication(extra.authInfo);
      const log = logger.withContext({ requestId, workspaceId: input.workspaceId });
      const auditLog = buildV3AuditLog(authentication, "created", "feedbackRecord", MCP_API_ROUTE);

      try {
        const response = await createV3FeedbackRecord({
          workspaceId: input.workspaceId,
          datasetId: input.datasetId,
          body: input,
          authentication,
          requestId,
          instance: MCP_API_ROUTE,
          auditLog,
        });

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
    }
  );
}
