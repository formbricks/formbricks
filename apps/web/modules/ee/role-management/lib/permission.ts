import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import {
  getAccessControlPermission,
  getIsDashboardViewerRoleEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { canAssignOrganizationRole } from "./assignable-roles";

export const checkRoleManagementPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isAccessControlAllowed = await getAccessControlPermission(organizationId);
  if (!isAccessControlAllowed) {
    throw new OperationNotAllowedError("Role management is not allowed for this organization");
  }
};

/**
 * The Dashboard viewer gate for every path that gives a role: single and bulk invites, invite edits and
 * membership edits. The role is given only while Access Control and Dashboards are both entitled
 * (ADR-0018); the entitlement is read only when a viewer is actually being given.
 */
export const assertDashboardViewerRoleAvailable = async (
  organizationId: string,
  roles: ReadonlyArray<TOrganizationRole>
): Promise<void> => {
  if (!roles.includes("dashboard_viewer")) return;

  if (!(await getIsDashboardViewerRoleEnabled(organizationId))) {
    throw new OperationNotAllowedError("The Dashboard viewer role is not available on this plan");
  }
};

/**
 * Whether a Manager may give `role`: the roles below their own, Member and Dashboard viewer. The viewer's
 * entitlement is checked separately by `assertDashboardViewerRoleAvailable`, so it is assumed here.
 */
export const canManagerAssignRole = (role: TOrganizationRole): boolean =>
  canAssignOrganizationRole({
    assignerRole: "manager",
    role,
    isFormbricksCloud: IS_FORMBRICKS_CLOUD,
    isDashboardViewerRoleEnabled: true,
  });
