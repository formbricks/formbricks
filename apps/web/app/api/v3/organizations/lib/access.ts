import "server-only";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";

export const ORGANIZATION_MANAGER_REQUIRED_MESSAGE =
  "Only organization owners and managers, signed in as themselves, can do this. API keys cannot make organization-level changes.";

/**
 * Organization-level writes (rename, create a workspace, invite) belong to a signed-in owner or manager.
 * An API key is bound to workspace grants, not to a person with an organization role, so it is refused
 * with the same answer an unauthorized user gets: whether the organization exists is not revealed.
 *
 * Returns the acting user's id, or the `Response` to relay. Authorization happens here, not in the
 * route wrapper, so the MCP tool that calls the operation directly gets the same answer.
 */
export async function requireV3OrganizationManager(
  authentication: TV3Authentication,
  organizationId: string,
  requestId: string,
  instance: string
): Promise<Response | { userId: string }> {
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

  return allowed ? { userId } : problemForbidden(requestId, ORGANIZATION_MANAGER_REQUIRED_MESSAGE, instance);
}
