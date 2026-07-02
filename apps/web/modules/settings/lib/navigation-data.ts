import "server-only";
import type { Session } from "@formbricks/types/auth";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import type { TWorkspace } from "@formbricks/types/workspace";
import { getOrganizationsByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/organization";
import { getWorkspacesByUserId } from "@/app/(app)/workspaces/[workspaceId]/lib/workspace";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getMonthlyOrganizationResponseCount, getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { getFeedbackDirectoriesForUser } from "@/modules/ee/feedback-directory/lib/feedback-directory";
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
  // Whether the "Unify Feedback" settings category should be visible: owner/manager always, or a
  // member who can reach at least one feedback dataset through a workspace they belong to. Computed
  // once here so the sidebar doesn't run an access query on every render.
  canViewUnifyFeedback: boolean;
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

  // Full workspace object (not just id/name) so the shell can supply the WorkspaceContext.
  const currentWorkspace = workspaces[0] ? await getWorkspace(workspaces[0].id) : null;
  const isOwnerOrManager = membership.role === "owner" || membership.role === "manager";
  // Owner/manager short-circuits (they always see the category); otherwise check whether the member
  // can reach any dataset. getFeedbackDirectoriesForUser is reactCache'd, so a page that later needs
  // the same list reuses this result within the render.
  const canViewUnifyFeedback =
    isOwnerOrManager || (await getFeedbackDirectoriesForUser(userId, organization.id)).length > 0;

  return {
    session,
    user,
    organization,
    membershipRole: membership.role,
    isAccessControlAllowed,
    isOwnerOrManager,
    canViewUnifyFeedback,
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
