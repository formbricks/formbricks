import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "@formbricks/logger";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";

type McpMutationExtra = { authInfo?: AuthInfo };

/**
 * Shared audit lifecycle for every MCP mutation tool, matching what the v3 route wrapper provides:
 * derive the authentication + request id, build the audit log, run the operation, mark
 * success/failure, and ALWAYS queue the audit log (even on throw) before propagating.
 *
 * The per-resource runners (survey/workflow) only supply the audit `resource`, optional logger
 * context, and a `run` callback that performs the actual v3 operation with the injected
 * authentication/requestId/auditLog — so the try/catch/status/queue logic lives in exactly one place.
 */
export async function runMcpMutation(
  extra: McpMutationExtra,
  {
    action,
    resource,
    logContext = {},
  }: {
    action: Parameters<typeof buildV3AuditLog>[1];
    resource: Parameters<typeof buildV3AuditLog>[2];
    logContext?: Record<string, unknown>;
  },
  run: (args: {
    authentication: ReturnType<typeof getMcpAuthentication>;
    requestId: string;
    auditLog: ReturnType<typeof buildV3AuditLog>;
  }) => Promise<Response>
): Promise<CallToolResult> {
  const requestId = getMcpRequestId(extra.authInfo);
  const authentication = getMcpAuthentication(extra.authInfo);
  const log = logger.withContext({ requestId, ...logContext });
  const auditLog = buildV3AuditLog(authentication, action, resource, MCP_API_ROUTE);

  try {
    const response = await run({ authentication, requestId, auditLog });

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
