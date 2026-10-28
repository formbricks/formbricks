import type { McpServer } from "@modelcontextprotocol/server";
import { logger } from "@formbricks/logger";
import {
  type TV3DocumentKind,
  ZV3DocumentEnvelope,
  ZV3DocumentKind,
  ZV3DocumentPushResult,
} from "@/app/api/v3/documents/lib/envelope";
import { getDocumentAdapter } from "@/app/api/v3/documents/lib/registry";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import {
  createMcpInsufficientScopeResponse,
  getMcpAuthentication,
  getMcpRequestId,
  getMcpToolAuthInfo,
  hasMcpScopes,
} from "../auth";
import { responseToMcpToolResult } from "../errors";
import {
  DOCUMENT_READ_SCOPE,
  DOCUMENT_WRITE_SCOPE,
  type TMcpPullDocumentInput,
  type TMcpPushDocumentInput,
  ZMcpPullDocumentInput,
  ZMcpPushDocumentInput,
} from "./document-schemas";
import { registerScopedTool } from "./guard-scopes";
import { mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";

/** The `kind` of a raw tool input, before schema validation has run. */
const kindOf = (input: unknown): TV3DocumentKind | undefined => {
  const parsed = ZV3DocumentKind.safeParse((input as { kind?: unknown } | undefined)?.kind);
  return parsed.success ? parsed.data : undefined;
};

/**
 * Pull and push (ADR 0015): one generic pair for surveys, creatives and workflows instead of six tools.
 * Surveys and creatives ride on the survey scopes, workflows on the workflow scopes, as their own tools
 * do. The registration gate admits either family, because the family a call needs depends on its `kind`;
 * the kind's own scope is then checked here, before the adapter, and a refusal is audited like any other.
 */
export function registerDocumentTools(server: McpServer): void {
  registerScopedTool(
    server,
    "pull_document",
    {
      title: "Pull document",
      description:
        "Read a survey, creative or workflow as one JSON document you can edit and push back with push_document. The result carries `updatedAt`, which the push must send as expectedUpdatedAt. The document holds the editable state only: no status, counts or other server-owned fields. Workflow ids inside a document refer to this workspace's surveys and ending cards.",
      inputSchema: ZMcpPullDocumentInput,
      outputSchema: mcpToolOutput(ZV3DocumentEnvelope),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    { anyOf: ["surveys:read", "workflows:read"] },
    async (input: TMcpPullDocumentInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);

      if (!hasMcpScopes(authInfo, [DOCUMENT_READ_SCOPE[input.kind]])) {
        return await responseToMcpToolResult(
          createMcpInsufficientScopeResponse(requestId, [DOCUMENT_READ_SCOPE[input.kind]]),
          requestId
        );
      }

      const response = await getDocumentAdapter(input.kind).pull({
        id: input.id,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "push_document",
    {
      title: "Push document",
      description:
        "Replace a survey's, creative's or workflow's editable state with an edited document from pull_document. Send the pulled updatedAt as expectedUpdatedAt: a push over a newer edit is refused (409, currentUpdatedAt). A push never publishes, pauses or enables anything; use the lifecycle tools for that. A push that removes data (survey questions that have responses, a live creative's destination) is refused until you repeat it with confirmDestructive: true after the user agreed. Use dryRun: true to see the changes first. A workflow's definition cannot be changed while it is enabled (a push may still rename it).",
      inputSchema: ZMcpPushDocumentInput,
      outputSchema: mcpToolOutput(ZV3DocumentPushResult),
      audit: {
        action: "updated",
        targetType: (input) => {
          const kind = kindOf(input);
          return kind ? getDocumentAdapter(kind).targetType : undefined;
        },
        targetIdArg: "id",
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    { anyOf: ["surveys:write", "workflows:write"] },
    async (input: TMcpPushDocumentInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const adapter = getDocumentAdapter(input.kind);
      const scope = DOCUMENT_WRITE_SCOPE[input.kind];

      if (!hasMcpScopes(authInfo, [scope])) {
        // The registration gate only saw "some write scope"; record the refusal against the right kind.
        const auditLog = buildV3AuditLog(
          getMcpAuthentication(authInfo),
          "updated",
          adapter.targetType,
          getMcpResourceUrl()
        );
        if (auditLog) {
          auditLog.eventId = requestId;
          auditLog.targetId = input.id;
          await queueV3AuditLog(
            auditLog,
            requestId,
            logger.withContext({ requestId, tool: "push_document" })
          );
        }
        return await responseToMcpToolResult(
          createMcpInsufficientScopeResponse(requestId, [scope]),
          requestId
        );
      }

      const params = {
        id: input.id,
        document: input.document,
        expectedUpdatedAt: input.expectedUpdatedAt,
        dryRun: input.dryRun ?? false,
        confirmDestructive: input.confirmDestructive ?? false,
        instance: MCP_API_ROUTE,
      };

      // A dry run changes nothing, so it is not recorded as an update.
      if (params.dryRun) {
        const response = await adapter.push({
          ...params,
          authentication: getMcpAuthentication(authInfo),
          requestId,
        });
        return await responseToMcpToolResult(response, requestId);
      }

      return runMcpMutation(
        ctx,
        { action: "updated", resource: adapter.targetType, logContext: { kind: input.kind, id: input.id } },
        ({ authentication, requestId: mutationRequestId, auditLog }) =>
          adapter.push({ ...params, authentication, requestId: mutationRequestId, auditLog })
      );
    }
  );
}
