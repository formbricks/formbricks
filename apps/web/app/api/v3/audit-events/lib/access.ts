import "server-only";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getV3AuthorizationActor, requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getIsAuditLogsEnabled } from "@/modules/ee/license-check/lib/utils";

export const AUDIT_LOGS_NOT_ENABLED_DETAIL =
  "Audit logs are not enabled on this instance. They require AUDIT_LOG_ENABLED and an Enterprise license.";

/**
 * Who may read an organization's audit events: its owners and managers, or an API key holding `manage`
 * on a workspace of that organization. The key rule is the one `audit:read` is derived from for MCP
 * (`getMcpScopes`), so the scope and the operation agree.
 *
 * An API key belongs to one organization, so a key is refused for any other before anything is checked.
 * Its `manage` grant is then confirmed against the live authorization graph and the workspace's own
 * organization, not read off the key's snapshot alone.
 *
 * Authorization comes first, then the instance gate, so a caller without access never learns whether
 * audit logging is on. A missing organization and one the caller may not read answer the same 403.
 */
export async function requireAuditReadAccess({
  authentication,
  organizationId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
}): Promise<Response | { organizationId: string }> {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  const allowed =
    actor.type === "user"
      ? await can(actor, "organization.manage", { type: "organization", id: organizationId })
      : await apiKeyManagesOrganization(authentication as TAuthenticationApiKey, organizationId, requestId);
  if (!allowed) {
    return problemForbidden(requestId, undefined, instance);
  }

  if (!(await getIsAuditLogsEnabled())) {
    return problemForbidden(requestId, AUDIT_LOGS_NOT_ENABLED_DETAIL, instance);
  }

  return { organizationId };
}

async function apiKeyManagesOrganization(
  key: TAuthenticationApiKey,
  organizationId: string,
  requestId: string
): Promise<boolean> {
  if (key.organizationId !== organizationId) return false;

  const managed = key.workspacePermissions.find((permission) => permission.permission === "manage");
  if (!managed) return false;

  const access = await requireV3WorkspaceAccess(key, managed.workspaceId, "manage", requestId);
  if (access instanceof Response) return false;
  if (access.organizationId !== organizationId) {
    logger.warn({ requestId, apiKeyId: key.apiKeyId }, "API key grant resolved to another organization");
    return false;
  }
  return true;
}
