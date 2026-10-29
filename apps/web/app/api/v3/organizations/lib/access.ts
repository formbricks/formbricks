import "server-only";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";

export const ORGANIZATION_MANAGER_REQUIRED_MESSAGE =
  "Only organization owners and managers, signed in as themselves, can do this. API keys cannot make organization-level changes.";

/**
 * The one statement of "owner or manager": the roles `organization.manage` grants. The account context
 * reports it as `canManage`, and the organization write check below insists on it.
 */
export const isOrganizationManagerRole = (role: TOrganizationRole | null | undefined): boolean =>
  role === "owner" || role === "manager";

/**
 * The answer for a resource that is missing after the caller was already authorized to reach it. It is the
 * same 403 an unauthorized caller gets, with no message, so whether the resource exists is not revealed.
 */
export const problemHiddenResource = (requestId: string, instance: string): Response =>
  problemForbidden(requestId, undefined, instance);

/**
 * Organization-level writes (rename, create a workspace, invite) belong to a signed-in owner or manager.
 * An API key is bound to workspace grants, not to a person with an organization role, so it is refused
 * with the same answer an unauthorized user gets: whether the organization exists is not revealed.
 *
 * Returns the acting user's id and organization role, or the `Response` to relay. The graph check is the
 * authority; the membership role is read afterwards for callers that need to know which of the two roles
 * they are dealing with (only an owner may invite a manager), and a role that is not owner or manager
 * is refused even when the graph said yes, so the two can never disagree in the caller's favour.
 * Authorization happens here, not in the route wrapper, so the MCP tool that calls the operation directly
 * gets the same answer.
 */
export async function requireV3OrganizationManager(
  authentication: TV3Authentication,
  organizationId: string,
  requestId: string,
  instance: string
): Promise<Response | { userId: string; role: TOrganizationRole }> {
  if (!authentication) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  if (!("user" in authentication) || !authentication.user?.id) {
    return problemForbidden(requestId, ORGANIZATION_MANAGER_REQUIRED_MESSAGE, instance);
  }

  const userId = authentication.user.id;
  const allowed = await can({ type: "user", id: userId }, "organization.manage", {
    type: "organization",
    id: organizationId,
  });
  if (!allowed) {
    return problemForbidden(requestId, ORGANIZATION_MANAGER_REQUIRED_MESSAGE, instance);
  }

  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  const role = membership?.role;
  if (!role || !isOrganizationManagerRole(role)) {
    return problemForbidden(requestId, ORGANIZATION_MANAGER_REQUIRED_MESSAGE, instance);
  }

  return { userId, role };
}
