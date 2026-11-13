import "server-only";
import { logger } from "@formbricks/logger";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  problemForbidden,
  problemInternalError,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { loggableError } from "@/lib/utils/loggable-error";
import {
  MCP_GRANT_NOT_SAVED_CODE,
  MCP_GRANT_NOT_SAVED_DETAIL,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
} from "@/modules/auth/lib/mcp-grant-consent-errors";
import { revokeMcpClient } from "@/modules/auth/lib/oauth-grant-revocation";
import { isDashboardViewerOnly } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { listMcpGrantAccessOptions } from "@/modules/mcp/access-options";
import {
  type TEditMcpGrantResult,
  editMcpGrant,
  listAuthorizedMcpClients,
} from "@/modules/mcp/authorized-clients";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { queueMcpGrantAudit } from "@/modules/mcp/grant-store";
import { serializeAuthorizedMcpClient, serializeMcpGrant } from "./serializers";

/**
 * Authorized apps' grants (ENG-7152). A grant belongs to one user, so the only check is the session: every
 * read and write is keyed on the session user, and another user's grant answers like none.
 */

const getSessionUserId = (authentication: TV3Authentication): string | null =>
  authentication && "user" in authentication ? (authentication.user?.id ?? null) : null;

export async function listMcpGrantsOperation({
  authentication,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const userId = getSessionUserId(authentication);
  if (!userId) return problemUnauthorized(requestId, "Session required", instance);

  const [isDashboardViewer, accessOptions] = await Promise.all([
    isDashboardViewerOnly(userId),
    listMcpGrantAccessOptions(userId),
  ]);
  const clients = await listAuthorizedMcpClients(userId, { isDashboardViewer, accessOptions });
  return successResponse(
    { isDashboardViewer, accessOptions, clients: clients.map(serializeAuthorizedMcpClient) },
    { requestId }
  );
}

export async function updateMcpGrantOperation({
  authentication,
  clientId,
  permissions,
  access,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  clientId: string;
  permissions: TMcpGrantPermissions;
  access?: TMcpGrantAccessSelection;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const userId = getSessionUserId(authentication);
  if (!userId) return problemUnauthorized(requestId, "Session required", instance);
  // A refusal's entry: the grant store files a saved edit's entries under each organization it reaches.
  if (auditLog) auditLog.organizationId = UNKNOWN_DATA;

  const isDashboardViewer = await isDashboardViewerOnly(userId);
  let result: TEditMcpGrantResult;
  try {
    result = await editMcpGrant({ userId, clientId, permissions, access, isDashboardViewer });
  } catch (error) {
    // Nothing was saved: a narrowing SpiceDB couldn't apply (an outage), or a failed transaction. The
    // consent screen's refusal and message for the same failure, rather than the wrapper's generic 500.
    logger.error({ err: loggableError(error), userId, clientId }, "MCP grant edit couldn't be saved");
    return problemInternalError(requestId, MCP_GRANT_NOT_SAVED_DETAIL, instance, MCP_GRANT_NOT_SAVED_CODE);
  }
  switch (result.status) {
    case "not_found":
      return problemForbidden(requestId, undefined, instance);
    case "beyond_scopes":
      return problemUnprocessableContent(
        requestId,
        "This app didn't ask for that much access. Reconnect it so it asks again.",
        { instance, code: "mcp_grant_beyond_scopes" }
      );
    case "selection_unavailable": {
      const kind = result.field === "organizationIds" ? "organizations" : "workspaces";
      return problemUnprocessableContent(requestId, `Pick only ${kind} you have access to.`, {
        instance,
        code: MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
        invalid_params: [{ name: result.field, reason: `Pick only ${kind} you have access to` }],
      });
    }
    case "saved":
      // Audited by the grant store, one entry per organization the grant reaches before or after, with
      // both snapshots whole: the wrapper's single entry can name one organization and records a diff,
      // which hides what a narrowing removed. A refusal above keeps the wrapper's failure entry.
      skipV3AuditLog(auditLog);
      await queueMcpGrantAudit({
        action: "updated",
        actorUserId: userId,
        before: result.before,
        after: result.after,
      });
      return successResponse(serializeMcpGrant(result.after), { requestId });
  }
}

/**
 * Authorized apps' Revoke (spec stories 29 and 38): ends the session user's grant to the MCP client, its
 * consent and its tokens. Works for a `skipConsent` client too, which has a grant and no consent. Answers
 * 403 when the user has neither for the client, as Edit does, so another user's client can't be probed.
 */
export async function revokeMcpGrantOperation({
  authentication,
  clientId,
  requestId,
  instance,
  auditLog,
}: {
  authentication: TV3Authentication;
  clientId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const userId = getSessionUserId(authentication);
  if (!userId) return problemUnauthorized(requestId, "Session required", instance);
  if (auditLog) auditLog.organizationId = UNKNOWN_DATA;

  const revoked = await revokeMcpClient({ userId, clientId });
  if (!revoked) return problemForbidden(requestId, undefined, instance);

  // Audited by the grant store, one entry per organization the grant reached, as Edit is.
  skipV3AuditLog(auditLog);
  for (const grant of revoked.grants) {
    await queueMcpGrantAudit({ action: "deleted", actorUserId: userId, before: grant, after: null });
  }
  return successResponse({ clientId }, { requestId });
}
