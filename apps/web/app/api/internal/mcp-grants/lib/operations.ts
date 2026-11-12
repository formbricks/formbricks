import "server-only";
import {
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { isDashboardViewerOnly } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { listMcpGrantAccessOptions } from "@/modules/mcp/access-options";
import { editMcpGrant, listMcpConnections } from "@/modules/mcp/connections";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { getMcpGrantAuditSnapshot } from "@/modules/mcp/grant-store";
import { serializeMcpConnection, serializeMcpGrant } from "./serializers";

/**
 * Authorized apps' grants (ENG-7152). A grant belongs to one user, so the only check is the session: every
 * read and write is keyed on the session user, and another user's connection answers like none.
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

  const isDashboardViewer = await isDashboardViewerOnly(userId);
  const [connections, accessOptions] = await Promise.all([
    listMcpConnections(userId, { isDashboardViewer }),
    listMcpGrantAccessOptions(userId),
  ]);
  return successResponse(
    { isDashboardViewer, accessOptions, connections: connections.map(serializeMcpConnection) },
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
  // A grant belongs to a user, not an organization, as the consent hook's entries record it.
  if (auditLog) auditLog.organizationId = UNKNOWN_DATA;

  const result = await editMcpGrant({
    userId,
    clientId,
    permissions,
    access,
    isDashboardViewer: await isDashboardViewerOnly(userId),
  });
  switch (result.status) {
    case "not_found":
      return problemForbidden(requestId, undefined, instance);
    case "beyond_scopes":
      return problemUnprocessableContent(
        requestId,
        "This app didn't ask for that much access. Reconnect it so it asks again.",
        { instance, code: "mcp_grant_beyond_scopes" }
      );
    case "saved":
      if (auditLog) {
        auditLog.targetId = result.after.id;
        auditLog.oldObject = getMcpGrantAuditSnapshot(result.before);
        auditLog.newObject = getMcpGrantAuditSnapshot(result.after);
      }
      return successResponse(serializeMcpGrant(result.after), { requestId });
  }
}
