import "server-only";
import type { TOrganization } from "@formbricks/types/organizations";
import type { TUser } from "@formbricks/types/user";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { listDashboardViewerWorkspaces } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { getIsDashboardViewerRoleEnabled, getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

export type TDashboardsUnavailable =
  | { kind: "notFound" }
  | { kind: "redirect"; path: string }
  | {
      kind: "show";
      user: TUser;
      /** Only what the page shows: the organization's billing and plan never reach a viewer. */
      organization: Pick<TOrganization, "id" | "name">;
      isRoleEnabled: boolean;
      isMultiOrgEnabled: boolean;
    };

/**
 * What a Dashboard viewer's unavailable page shows (ADR-0023): anyone who is not a viewer of
 * `organizationId` gets a 404, a viewer who can see dashboards again is sent to them, and otherwise the
 * page explains a lapsed plan (`isRoleEnabled` false) or a missing team grant.
 */
export const getDashboardsUnavailable = async (
  userId: string,
  organizationId: string
): Promise<TDashboardsUnavailable> => {
  const [membership, organization, user] = await Promise.all([
    getMembershipByUserIdOrganizationId(userId, organizationId),
    getOrganization(organizationId),
    getUser(userId),
  ]);
  if (membership?.role !== "dashboard_viewer" || !organization || !user) return { kind: "notFound" };

  const [isRoleEnabled, isMultiOrgEnabled] = await Promise.all([
    getIsDashboardViewerRoleEnabled(organizationId),
    getIsMultiOrgEnabled(),
  ]);
  if (isRoleEnabled) {
    const [firstWorkspace] = await listDashboardViewerWorkspaces(userId, organizationId);
    if (firstWorkspace) return { kind: "redirect", path: `/workspaces/${firstWorkspace.id}/dashboards` };
  }

  return {
    kind: "show",
    user,
    organization: { id: organization.id, name: organization.name },
    isRoleEnabled,
    isMultiOrgEnabled,
  };
};
