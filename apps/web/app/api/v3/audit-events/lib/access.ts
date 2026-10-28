import "server-only";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getIsAuditLogsEnabled } from "@/modules/ee/license-check/lib/utils";

export const AUDIT_LOGS_NOT_ENABLED_DETAIL =
  "Audit logs are not enabled on this instance. They require AUDIT_LOG_ENABLED and an Enterprise license.";

/**
 * Who may read an organization's audit events: its owners and managers, or an API key with organization
 * access-control read access. The key rule is the one `audit:read` is derived from for MCP
 * (`getMcpScopes`), so the scope and the operation agree.
 *
 * The trail is organization-wide: it names actors and targets across every workspace, members and API
 * keys. A grant on one workspace, even `manage`, is not that, so a key needs the organization-level
 * `accessControl.read` grant, which is what administering an organization's members and teams takes.
 *
 * An API key belongs to one organization, so a key is refused for any other before anything else is
 * looked at. Authorization comes first, then the instance gate, so a caller without access never learns
 * whether audit logging is on. A missing organization and one the caller may not read answer the same 403.
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
      : apiKeyMayReadOrganizationAudit(authentication as TAuthenticationApiKey, organizationId);
  if (!allowed) {
    return problemForbidden(requestId, undefined, instance);
  }

  if (!(await getIsAuditLogsEnabled())) {
    return problemForbidden(requestId, AUDIT_LOGS_NOT_ENABLED_DETAIL, instance);
  }

  return { organizationId };
}

function apiKeyMayReadOrganizationAudit(key: TAuthenticationApiKey, organizationId: string): boolean {
  return key.organizationId === organizationId && key.organizationAccess?.accessControl?.read === true;
}
