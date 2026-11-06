import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
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
 * The one rule every path that gives an organization role runs: single and bulk invites, invite
 * edits, membership edits, and the management API's user create and update.
 *
 * - Billing only on Formbricks Cloud.
 * - What the assigner may give (`canAssignOrganizationRole`): Owners every role, Managers Member and
 *   Dashboard viewer, nobody else anything; only an Owner changes an existing Owner's role.
 * - The Dashboard viewer only while Access Control and Dashboards are both entitled (ADR-0025), read once
 *   and only when a viewer is being given — and never through the management API (`channel`), which
 *   cannot enforce the role's rules (no team admin, team-granted workspaces).
 *
 * Team admins invite Members through `inviteUserAction`'s own rule and never reach this.
 */
export const assertCanAssignRole = async ({
  organizationId,
  assignerRole,
  roles,
  targetCurrentRole,
  channel = "app",
}: {
  organizationId: string;
  assignerRole: TOrganizationRole | null | undefined;
  roles: ReadonlyArray<TOrganizationRole>;
  targetCurrentRole?: TOrganizationRole | null;
  channel?: "app" | "managementApi";
}): Promise<void> => {
  const requested = [...new Set(roles)];
  if (targetCurrentRole === "owner" && assignerRole !== "owner") {
    throw new OperationNotAllowedError("Only owners can change the role of an owner");
  }
  if (!IS_FORMBRICKS_CLOUD && requested.includes("billing")) {
    throw new ValidationError("Billing role is not allowed");
  }

  const givesViewer = requested.includes("dashboard_viewer");
  const isDashboardViewerRoleEnabled =
    givesViewer && channel === "app" && (await getIsDashboardViewerRoleEnabled(organizationId));
  if (givesViewer && channel === "app" && !isDashboardViewerRoleEnabled) {
    throw new OperationNotAllowedError("The Dashboard viewer role is not available on this plan");
  }

  const refused = requested.some(
    (role) =>
      !canAssignOrganizationRole({
        assignerRole,
        role,
        targetCurrentRole,
        isFormbricksCloud: IS_FORMBRICKS_CLOUD,
        isDashboardViewerRoleEnabled,
      })
  );
  if (refused) {
    throw new OperationNotAllowedError(
      assignerRole === "manager"
        ? "Managers can only give the Member and Dashboard viewer roles"
        : "You are not allowed to give this role"
    );
  }
};
