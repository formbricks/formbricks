import "server-only";
import { cookies } from "next/headers";
import type { Session } from "@formbricks/types/auth";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import type { TWorkspace } from "@formbricks/types/workspace";
import { getOrganizationsByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/organization";
import { getWorkspacesByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/workspace";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { FORMBRICKS_WORKSPACE_ID_COOKIE } from "@/lib/localStorage";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getMonthlyOrganizationResponseCount, getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import {
  getAccessControlPermission,
  getOrganizationWorkspacesLimit,
} from "@/modules/ee/license-check/lib/utils";

type TOrganizationWithBilling = NonNullable<Awaited<ReturnType<typeof getOrganization>>>;
type TLicense = Awaited<ReturnType<typeof getEnterpriseLicense>>;
type TUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export interface TSettingsLayoutData {
  session: Session;
  user: TUser;
  organization: TOrganizationWithBilling;
  membershipRole?: TOrganizationRole;
  isAccessControlAllowed: boolean;
  isOwnerOrManager: boolean;
  isMultiOrgEnabled: boolean;
  organizationWorkspacesLimit: number;
  license: TLicense;
  responseCount: number;
  isFormbricksCloud: boolean;
  isDevelopment: boolean;
  publicDomain: string;
  // The "current" workspace used to render the sidebar's Workspace section, back link, and the
  // WorkspaceContext that reused settings components depend on. Null when the user has no workspace
  // (the org/account settings still render — Phase 2 handles that empty state).
  currentWorkspace: TWorkspace | null;
  backUrl: string;
}

/**
 * Assembles everything the shared settings shell (banners + sidebar + top bar) needs for the
 * org-scoped and account-scoped settings routes, where there is no `workspaceId` in the URL. All of
 * it is organization-level data, so no workspace is required to resolve it; we additionally surface
 * the user's first accessible workspace so the sidebar's Workspace section renders identically.
 *
 * `organizationId` is optional — account settings don't carry one, so we default to the user's first
 * organization.
 *
 * The "current" workspace is resolved from the `formbricks-workspace-id` cookie (set by the proxy from
 * the last visited `/workspaces/[workspaceId]` path), so navigating into the workspace-agnostic
 * org-settings routes keeps the workspace you came from. If the cookie is missing or points at a
 * workspace the user can't access, it falls back to the first accessible workspace.
 */
export const getSettingsLayoutData = async (
  userId: string,
  organizationId?: string
): Promise<TSettingsLayoutData | null> => {
  const session = await getSession();
  if (!session?.user) return null;

  let orgId = organizationId;
  if (!orgId) {
    const organizations = await getOrganizationsByUserId(userId);
    orgId = organizations[0]?.id;
  }
  if (!orgId) return null;

  const [user, organization, membership] = await Promise.all([
    getUser(userId),
    getOrganization(orgId),
    getMembershipByUserIdOrganizationId(userId, orgId),
  ]);
  if (!user || !organization || !membership) return null;

  const [isAccessControlAllowed, license, organizationWorkspacesLimit, workspaces] = await Promise.all([
    getAccessControlPermission(organization.id),
    getEnterpriseLicense(),
    getOrganizationWorkspacesLimit(organization.id),
    getWorkspacesByUserId(userId, membership),
  ]);

  const responseCount = IS_FORMBRICKS_CLOUD ? await getMonthlyOrganizationResponseCount(organization.id) : 0;

  // Resolve the workspace to display in the shell. Prefer the last active workspace (from the
  // formbricks-workspace-id cookie the proxy sets on /workspaces/[workspaceId] visits) when it
  // belongs to the accessible list; otherwise fall back to the first accessible workspace so the
  // shell always has something to show.
  const cookieStore = await cookies();
  const preferredWorkspaceId = cookieStore.get(FORMBRICKS_WORKSPACE_ID_COOKIE)?.value;
  const resolvedWorkspaceId =
    preferredWorkspaceId && workspaces.some((w) => w.id === preferredWorkspaceId)
      ? preferredWorkspaceId
      : workspaces[0]?.id;
  // Full workspace object (not just id/name) so the shell can supply the WorkspaceContext.
  const currentWorkspace = resolvedWorkspaceId ? await getWorkspace(resolvedWorkspaceId) : null;
  const isOwnerOrManager = membership.role === "owner" || membership.role === "manager";

  return {
    session,
    user,
    organization,
    membershipRole: membership.role,
    isAccessControlAllowed,
    isOwnerOrManager,
    isMultiOrgEnabled: license.features?.isMultiOrgEnabled ?? false,
    organizationWorkspacesLimit,
    license,
    responseCount,
    isFormbricksCloud: IS_FORMBRICKS_CLOUD,
    isDevelopment: IS_DEVELOPMENT,
    publicDomain: getPublicDomain(),
    currentWorkspace,
    backUrl: currentWorkspace ? `/workspaces/${currentWorkspace.id}/surveys` : "/",
  };
};
