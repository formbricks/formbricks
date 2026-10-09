import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * What a data retention route asks of the caller, in the app's authorization vocabulary:
 * - `read_access`: owners, managers and members (not billing) can read the policies and exemptions
 * - `manage`: owners and managers change them, and read History and its CSV (which names people)
 * - `manage_access`: Reactivate, which is user management
 */
export type TRetentionOrgAction =
  | "organization.read_access"
  | "organization.manage"
  | "organization.manage_access";

export const RETENTION_NOT_ENABLED_DETAIL =
  "Data retention is not enabled for this organization. It requires an Enterprise plan or license.";

/**
 * Authorize a request against one organization, without the data retention licence: for what is user
 * management rather than data retention (Reactivate), which must keep working after the entitlement
 * lapses, or members deactivated while it was held could never come back.
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
  action: TRetentionOrgAction;
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

/**
 * Authorize a data retention request against one organization (ENG-3695): `requireOrgActionAccess`,
 * then the data retention licence.
 *
 * Authorization comes before the licence check, so a non-member never learns whether the organization
 * holds the entitlement.
 */
export async function requireRetentionOrgAccess(
  params: Parameters<typeof requireOrgActionAccess>[0]
): Promise<Response | { organizationId: string; userId: string }> {
  const access = await requireOrgActionAccess(params);
  if (access instanceof Response) return access;

  if (!(await getIsDataRetentionEnabled(access.organizationId))) {
    return problemForbidden(params.requestId, RETENTION_NOT_ENABLED_DETAIL, params.instance);
  }

  return access;
}
