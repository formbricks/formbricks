import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";

/**
 * The user-management role floor (`USER_MANAGEMENT_MINIMUM_ROLE`), as the app's own entry points ask it.
 *
 * `organization.manage_access` *is* this decision in the central vocabulary: the SpiceDB evaluator maps
 * the floor onto the schema (`owner` → write, `manager` → manage_access, `disabled` → deny), and
 * `lib/authorization/manage-access.integration.test.ts` pins it to `getUserManagementAccess` against
 * real rows. Core policy, not a licensed feature: it holds with or without a licence.
 *
 * Asked by every server action that lets an owner or manager change who is invited or a member, by
 * the onboarding invite, by minting an API key with organization write access, and by the pages that
 * decide whether to offer those controls, so a control is never offered where its action refuses. The v2
 * users API still decides it through `getUserManagementAccess`, pinned equal by the integration test.
 * `organization.manage` is a different capability that the actions still require on top of this one.
 * Team admins inviting into their own teams are decided by `team.manage` instead: they are plain
 * members, below every `owner` / `manager` floor by definition, so the floor cannot rank them. The one
 * floor value that does apply to them is `disabled`, which switches user management off for everyone
 * (`assertTeamAdminInviteAllowed`, in its own module so the many importers of this one do not load the constants).
 */
export const canManageUsers = async (userId: string, organizationId: string): Promise<boolean> =>
  can({ type: "user", id: userId }, "organization.manage_access", {
    type: "organization",
    id: organizationId,
  });

/** `canManageUsers`, refusing with the floor's own error. */
export const assertUserManagementAllowed = async (userId: string, organizationId: string): Promise<void> => {
  if (!(await canManageUsers(userId, organizationId))) {
    throw new OperationNotAllowedError("User management is not allowed for your role");
  }
};
