import "server-only";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";

export const TEAMS_SIGNED_IN_MESSAGE =
  "Teams are read and changed by a signed-in person. API keys cannot do this.";
export const TEAMS_LICENCE_MESSAGE =
  "Teams are not included in this organization's plan. They need an Enterprise licence, or a paid plan on Formbricks Cloud.";
export const TEAM_WORKSPACE_ACCESS_MESSAGE =
  "Only organization owners and managers can change which workspaces a team can use.";
export const TEAM_ADMIN_SELF_MESSAGE =
  "A team admin who is not an organization owner or manager cannot remove themselves from the team or change their own team role.";

/**
 * The signed-in person behind a team operation, or the `Response` to relay. An API key is bound to
 * workspace grants, not to a person with an organization or team role, so it is refused with a 403 (the
 * REST routes are session-only and answer 401 before they get here; an MCP call with a key arrives here).
 */
export function requireTeamsUser(
  authentication: TV3Authentication,
  requestId: string,
  instance: string
): Response | { userId: string; name: string | null } {
  if (!authentication) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }
  if (!("user" in authentication) || !authentication.user?.id) {
    return problemForbidden(requestId, TEAMS_SIGNED_IN_MESSAGE, instance);
  }

  return { userId: authentication.user.id, name: authentication.user.name ?? null };
}

/**
 * Teams are an Enterprise feature (the access-control licence). Without it every team operation answers
 * this documented 403 rather than an empty success, so an agent never reads "no teams" for "no licence".
 * Call it only after the caller's own access to the organization is established: it names a plan, not a
 * resource, so it reveals nothing about one the caller cannot see.
 */
export async function requireTeamsLicence(
  organizationId: string,
  requestId: string,
  instance: string
): Promise<Response | null> {
  if (await getAccessControlPermission(organizationId)) return null;

  return problemForbidden(requestId, TEAMS_LICENCE_MESSAGE, instance);
}
