import "server-only";
import { requireActionAccess } from "@/app/api/internal/lib/action-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { canManageUsers } from "@/lib/membership/user-management";

/**
 * What an internal organization route asks of the caller, in the app's authorization vocabulary:
 * - `read`: every member, billing included
 * - `read_access`: owners, managers and members (not billing)
 * - `write`: the organization itself — its name, or deleting it (owners)
 * - `manage`: owners and managers
 * - `manage_access`: user management (owners and managers, per `USER_MANAGEMENT_MINIMUM_ROLE`)
 * - `manage_api_keys`: minting and managing the organization's API keys (owners and managers)
 * - `manage_billing`: the organization's plan and its limits (owners, managers and billing)
 */
export type TOrgAction =
  | "organization.read"
  | "organization.read_access"
  | "organization.write"
  | "organization.manage"
  | "organization.manage_access"
  | "organization.manage_api_keys"
  | "organization.manage_billing";

/**
 * Authorize a request against one organization: a session user who may take `action` on it. No
 * licence check: entitlement-gated routes add their own after this (data retention does, in
 * `requireRetentionOrgAccess`), and user management such as Reactivate needs none.
 *
 * Callers pass an organization they derived from the resource or one the client named in the query;
 * either way this is the check, never the id itself. A missing organization and one the caller may not
 * access produce the same 403, byte for byte, so the route can't be used to probe which organizations
 * exist.
 */
export async function requireOrgActionAccess({
  authentication,
  organizationId,
  action,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  organizationId: string;
  action: TOrgAction;
  requestId: string;
  instance?: string;
}): Promise<Response | { organizationId: string; userId: string }> {
  const access = await requireActionAccess({
    authentication,
    action,
    resource: { type: "organization", id: organizationId },
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  return { organizationId, userId: access.userId };
}

export const USER_MANAGEMENT_NOT_ALLOWED_DETAIL = "User management is not allowed for your role";

/**
 * Authorize an owner's or manager's change to who is invited or a member, as the server actions it replaces
 * asked it: the user-management floor (`assertUserManagementAllowed`, `organization.manage_access`) first,
 * then `organization.manage`, each only once the one before allowed. The floor refuses with its reason, as
 * those actions did. That reason is the same for an organization that doesn't exist or that the caller
 * isn't in, so it reveals nothing about which organizations exist.
 */
export async function requireUserManagementAccess({
  authentication,
  organizationId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
}): Promise<Response | { organizationId: string; userId: string }> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  if (!(await canManageUsers(actor.id, organizationId))) {
    return problemForbidden(requestId, USER_MANAGEMENT_NOT_ALLOWED_DETAIL, instance);
  }

  return requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
}
