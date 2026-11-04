import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";

/**
 * The user-management role floor (`USER_MANAGEMENT_MINIMUM_ROLE`) for organization owners and managers.
 *
 * `organization.manage_access` *is* this decision in the central vocabulary: the SpiceDB evaluator maps
 * the floor onto the schema (`owner` → write, `manager` → manage_access, `disabled` → deny). Every
 * server-side entry point that lets an owner or manager change who is invited or a member asks it here,
 * so the floor cannot be skipped by calling an action the UI hides. `organization.manage` is a different
 * capability that the callers still require on top of this one.
 *
 * Team admins inviting into their own teams are decided by `team.manage` instead, as the settings page
 * does, so they do not come through here.
 */
export const assertUserManagementAllowed = async (userId: string, organizationId: string): Promise<void> => {
  const canManageAccess = await can({ type: "user", id: userId }, "organization.manage_access", {
    type: "organization",
    id: organizationId,
  });

  if (!canManageAccess) {
    throw new OperationNotAllowedError("User management is not allowed for your role");
  }
};
