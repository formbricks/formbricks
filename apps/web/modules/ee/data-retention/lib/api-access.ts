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
 * Authorize a data retention request against one organization (ENG-3695).
 *
 * Callers pass an organization they derived from the resource (an exemption's or a run's own
 * `organizationId`, a survey's workspace) or one the client named in the query; either way this is the
 * check, never the id itself. A missing organization and one the caller may not access produce the same
 * 403, byte for byte, so the route can't be used to probe which organizations exist.
 *
 * Authorization comes before the licence check, so a non-member never learns whether the organization
 * holds the entitlement.
 */
export async function requireRetentionOrgAccess({
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

  if (!(await getIsDataRetentionEnabled(organizationId))) {
    return problemForbidden(requestId, RETENTION_NOT_ENABLED_DETAIL, instance);
  }

  return { organizationId, userId: actor.id };
}
