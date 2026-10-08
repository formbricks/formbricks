import "server-only";
import { cookies } from "next/headers";
import { getOrganizationsByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/organization";
import { FORMBRICKS_ORGANIZATION_ID_COOKIE, FORMBRICKS_WORKSPACE_ID_COOKIE } from "@/lib/localStorage";
import { getWorkspace } from "@/lib/workspace/service";

/**
 * Resolves the organization for the routes that carry none in the URL (account settings, marketing
 * links like /billing), so opening one keeps the user on the organization they are in instead of
 * switching a multi-organization user to their first one.
 *
 * The organization cookie wins when present: the proxy only keeps it while an organization-scoped
 * page (e.g. the landing page of an organization with no workspace yet) was visited after the last
 * workspace. Otherwise the organization of the last active workspace is the one the user is in.
 *
 * Both cookies outlive leaving an organization and the workspace cookie outlives deleting a
 * workspace, so each is only trusted while it still resolves to an organization the user is a
 * member of.
 */
export const resolveActiveOrganizationId = async (
  userId: string,
  activeWorkspaceId: string | undefined,
  activeOrganizationId: string | undefined
): Promise<string | undefined> => {
  const organizations = await getOrganizationsByUserId(userId);

  if (activeOrganizationId && organizations.some((org) => org.id === activeOrganizationId)) {
    return activeOrganizationId;
  }

  if (activeWorkspaceId) {
    const activeWorkspace = await getWorkspace(activeWorkspaceId);
    if (activeWorkspace && organizations.some((org) => org.id === activeWorkspace.organizationId)) {
      return activeWorkspace.organizationId;
    }
  }

  return organizations[0]?.id;
};

/** `resolveActiveOrganizationId` fed from the request's active-context cookies (set by the proxy). */
export const getActiveOrganizationIdForUser = async (userId: string): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return resolveActiveOrganizationId(
    userId,
    cookieStore.get(FORMBRICKS_WORKSPACE_ID_COOKIE)?.value,
    cookieStore.get(FORMBRICKS_ORGANIZATION_ID_COOKIE)?.value
  );
};
