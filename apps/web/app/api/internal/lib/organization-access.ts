import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";

/**
 * What an internal organization route asks of the caller, in the app's authorization vocabulary:
 * - `read_access`: owners, managers and members (not billing)
 * - `manage`: owners and managers
 * - `manage_access`: user management (owners and managers, per `USER_MANAGEMENT_MINIMUM_ROLE`)
 */
export type TOrgAction = "organization.read_access" | "organization.manage" | "organization.manage_access";

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
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  if (!(await can(actor, action, { type: "organization", id: organizationId }))) {
    return problemForbidden(requestId, undefined, instance);
  }

  return { organizationId, userId: actor.id };
}
