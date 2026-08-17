import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { logger } from "@formbricks/logger";
import {
  countV3FeedbackRecords,
  createV3FeedbackRecord,
  createV3FeedbackRecords,
  deleteV3FeedbackRecord,
  findSimilarV3FeedbackRecords,
  getV3FeedbackRecord,
  listV3FeedbackDatasets,
  listV3FeedbackRecords,
  searchV3FeedbackRecords,
  updateV3FeedbackRecord,
} from "@/app/api/v3/feedbackRecords/lib/operations";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { type TMcpToolContext, getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { guardMcpScopes } from "./guard-scopes";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  type TMcpCountFeedbackRecordsInput,
  type TMcpCreateFeedbackRecordInput,
  type TMcpCreateFeedbackRecordsInput,
  type TMcpDeleteFeedbackRecordInput,
  type TMcpFindSimilarFeedbackRecordsInput,
  type TMcpGetFeedbackRecordInput,
  type TMcpListFeedbackDatasetsInput,
  type TMcpListFeedbackRecordsInput,
  type TMcpSearchFeedbackRecordsInput,
  type TMcpUpdateFeedbackRecordInput,
  ZMcpCountFeedbackRecordsInput,
  ZMcpCreateFeedbackRecordInput,
  ZMcpCreateFeedbackRecordsInput,
  ZMcpDeleteFeedbackRecordInput,
  ZMcpFindSimilarFeedbackRecordsInput,
  ZMcpGetFeedbackRecordInput,
  ZMcpListFeedbackDatasetsInput,
  ZMcpListFeedbackRecordsInput,
  ZMcpSearchFeedbackRecordsInput,
  ZMcpUpdateFeedbackRecordInput,
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
  return async (input: TInput, ctx: TMcpToolContext): Promise<CallToolResult> => {
    const authInfo = getMcpToolAuthInfo(ctx);
    const requestId = getMcpRequestId(authInfo);
    const scopeError = await guardMcpScopes(authInfo, FEEDBACK_RECORDS_READ_SCOPE, requestId);
    if (scopeError) {
      return scopeError;
    }

    const response = await run(input, getMcpAuthentication(authInfo), requestId);
    return await responseToMcpToolResult(response, requestId);
  };
}

/**
 * Shared handler body for the mutating tools: write scope, plus the audit-log lifecycle — the record is
 * stamped by the operation, and the outcome (`success`, or an `eventId` on failure) by this wrapper. A
 * throw still queues the log, so a failed mutation is never silently unaudited.
 */
function writeHandler<TInput extends { workspaceId: string }>(
  action: "created" | "updated" | "deleted",
  run: (
    input: TInput,
    authentication: TV3Authentication,
    requestId: string,
    auditLog?: TV3AuditLog
  ) => Promise<Response>
) {
  return async (input: TInput, ctx: TMcpToolContext): Promise<CallToolResult> => {
    const authInfo = getMcpToolAuthInfo(ctx);
    const requestId = getMcpRequestId(authInfo);
    const scopeError = await guardMcpScopes(authInfo, FEEDBACK_RECORDS_WRITE_SCOPE, requestId);
    if (scopeError) {
      return scopeError;
    }

    // The scope gate above is the only part that differs from the survey/workflow tools, which get
    // theirs from registerScopedTool; the audit lifecycle itself is shared.
    return await runMcpMutation(
      ctx,
      { action, resource: "feedbackRecord", logContext: { workspaceId: input.workspaceId } },
      ({ authentication, requestId: mutationRequestId, auditLog }) =>
        run(input, authentication, mutationRequestId, auditLog)
    );
  };
}

export function registerFeedbackRecordTools(server: McpServer): void {
  server.registerTool(
    "list_feedback_datasets",
    {
      title: "List feedback datasets",
      description:
        "List the feedback datasets assigned to a Formbricks workspace. Use the returned id as datasetId for the other feedback-record tools.",
      inputSchema: ZMcpListFeedbackDatasetsInput,
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
        "List feedback records for a workspace's feedback dataset, with cursor pagination and optional filters. meta.datasetId and meta.datasetName report which dataset was searched, so an empty data array means that dataset holds no matching records — there is no need to call list_feedback_datasets to check. A workspace with no dataset at all fails with 422 instead. Filters: repeating one filter with several values ORs them, while different filters are AND-ed; there is no way to OR across different filters. Range filters are inclusive and exclude records whose column is empty, so value_number_min=0 drops every text answer and sentiment_score_min only ever matches enriched records — use has_sentiment=false to find the ones enrichment has not reached. Keep sort and order identical on every page of one traversal: a cursor is a position within one specific ordering, and presenting it with a different one is rejected.",
      inputSchema: ZMcpListFeedbackRecordsInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // The validated input is exactly the operation's filter contract, so it is spread rather than copied
    // field by field: adding a filter to the schema can't silently fail to reach the operation. Safe
    // because the schema is `.strict()` (ENG-2256), so an undeclared key is rejected before this handler
    // runs rather than spread onward, and the operation allowlists what reaches the Hub regardless.
    readOnlyHandler<TMcpListFeedbackRecordsInput>((input, authentication, requestId) =>
      listV3FeedbackRecords({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  server.registerTool(
    "count_feedback_records",
    {
      title: "Count feedback records",
      description:
        "Count the feedback records matching a set of filters, without fetching them. Use this for 'how many' questions — how many responses to one question, from one person, or in a date range — instead of paging through records to count them. Returns only the total plus the dataset it came from, never record content. Takes exactly the same filters as list_feedback_records, with the same OR-within-a-filter and AND-across-filters rules, so a count always describes the set the equivalent list would return. Ordering and pagination do not apply here and are rejected.",
      inputSchema: ZMcpCountFeedbackRecordsInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    readOnlyHandler<TMcpCountFeedbackRecordsInput>((input, authentication, requestId) =>
      countV3FeedbackRecords({ ...input, authentication, requestId, instance: MCP_API_ROUTE })
    )
  );

  server.registerTool(
    "get_feedback_record",
    {
      title: "Get feedback record",
      description: "Get one feedback record by id from a workspace's feedback dataset.",
      inputSchema: ZMcpGetFeedbackRecordInput,
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
      inputSchema: ZMcpCreateFeedbackRecordInput,
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
    "create_feedback_records",
    {
      title: "Create feedback records",
      description:
        "Create several feedback records in one call — use this instead of calling create_feedback_record repeatedly when importing a batch. Every record is validated before any is written, so an invalid record fails the whole call rather than storing part of the batch. If the feedback service rejects some records (a duplicate submission, say), the created ones are returned and meta.failures lists the rest by index, so only those need retrying; check meta.failed. Records in one call are NOT automatically treated as one submission: each record without a submission_id gets its own generated one, so to record several answers given together (a survey response, a call with a rating and a comment) set the same submission_id on all of them.",
      inputSchema: ZMcpCreateFeedbackRecordsInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input: TMcpCreateFeedbackRecordsInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const scopeError = await guardMcpScopes(authInfo, FEEDBACK_RECORDS_WRITE_SCOPE, requestId);
      if (scopeError) {
        return scopeError;
      }

      const authentication = getMcpAuthentication(authInfo);
      const log = logger.withContext({ requestId, workspaceId: input.workspaceId });
      // One audit event per record, not per call: N records created is N creations to an auditor. The
      // operation stamps the entries it created (identified by `targetId`) — and indexes this array by
      // record position, so it is deliberately NOT compacted. Dropping an entry would shift the rest and
      // attribute a creation to the wrong record. `buildV3AuditLog` returns undefined for every record or
      // none (it only depends on whether auditing is enabled), so the holes are all-or-nothing.
      const auditLogs = input.records.map(() =>
        buildV3AuditLog(authentication, "created", "feedbackRecord", getMcpResourceUrl())
      );

      const queueOutcome = async () => {
        // `targetId` must be compared against the placeholder, not just tested for truthiness:
        // buildAuditLogBaseObject seeds it with UNKNOWN_DATA ("unknown"), so a truthy check matches
        // every entry — including records the Hub rejected — and would emit a success event
        // asserting a creation that never happened, with targetId "unknown" and no newObject.
        // Only createV3FeedbackRecords overwrites it, and only for records it actually created.
        const stamped = auditLogs.filter(
          (auditLog): auditLog is TV3AuditLog => !!auditLog && auditLog.targetId !== UNKNOWN_DATA
        );
        for (const auditLog of stamped) {
          auditLog.status = "success";
          await queueV3AuditLog(auditLog, requestId, log);
        }
        if (stamped.length > 0) {
          return;
        }
        // Nothing created — record the attempt once rather than once per record.
        const first = auditLogs.find(Boolean);
        if (first) {
          first.eventId = requestId;
          await queueV3AuditLog(first, requestId, log);
        }
      };

      try {
        const response = await createV3FeedbackRecords({
          workspaceId: input.workspaceId,
          datasetId: input.datasetId,
          body: input,
          authentication,
          requestId,
          instance: MCP_API_ROUTE,
          auditLogs,
        });

        await queueOutcome();
        return await responseToMcpToolResult(response, requestId);
      } catch (error) {
        await queueOutcome();
        throw error;
      }
    }
  );

  server.registerTool(
    "update_feedback_record",
    {
      title: "Update feedback record",
      description:
        "Correct the value of an existing feedback record — the text, number, boolean, date or chosen option, plus user_id, language and metadata. Only the fields you send are changed, with one exception: metadata is REPLACED wholesale, so to add a key you must send the existing keys too (fetch the record first with get_feedback_record). Send the value field that matches the record's field_type — value_text for text, value_number for nps/csat/ces/rating/number, value_boolean for boolean, value_date for date, value_text and/or value_id for categorical; sending any other one is rejected, because field_type itself cannot be changed. A record's provenance cannot be changed either (which source, question, submission or when it was collected); correcting those means deleting the record and creating it again. Editing the text clears the derived sentiment, emotions and translation and regenerates them in the background, so the response comes back without them — that means 'being recomputed', not 'none'. Semantic search catches up with an edit a moment later, and clearing a record's text makes it unsearchable.",
      inputSchema: ZMcpUpdateFeedbackRecordInput,
      annotations: {
        readOnlyHint: false,
        // Overwrites a stored value irreversibly (the previous value survives only in the audit log), so
        // the same hints as patch_survey — a client should be able to warn before calling it.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    writeHandler<TMcpUpdateFeedbackRecordInput>("updated", (input, authentication, requestId, auditLog) =>
      updateV3FeedbackRecord({
        workspaceId: input.workspaceId,
        feedbackRecordId: input.feedbackRecordId,
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
      inputSchema: ZMcpDeleteFeedbackRecordInput,
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
      inputSchema: ZMcpSearchFeedbackRecordsInput,
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
        "Find the feedback records most similar to a given one — use it to see how widely a piece of feedback is echoed by others. Returns scored matches, best first, excluding the record itself. If the record has no embedding this reports a conflict rather than an empty result, and says which case it is: worth retrying for a record that was just created and is still being embedded, not worth retrying for one with no text (including text cleared by an update). Requires an embedding model on the feedback service; without one this fails with 503.",
      inputSchema: ZMcpFindSimilarFeedbackRecordsInput,
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
