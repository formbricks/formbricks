import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";

/**
 * `USER_MANAGEMENT_MINIMUM_ROLE=disabled` means nobody manages users from the app, an owner included.
 * A team admin's invite is decided by `team.manage` rather than by the floor's role ranking, so this is
 * the part of the floor that still reaches it: with user management disabled, instances that provision
 * users elsewhere (SSO, SCIM, the API) do not get invites from team admins either.
 */
export const isUserManagementDisabled = (): boolean => USER_MANAGEMENT_MINIMUM_ROLE === "disabled";

/** Refuses a team admin's invite while user management is disabled, with the floor's own error. */
export const assertTeamAdminInviteAllowed = (): void => {
  if (isUserManagementDisabled()) {
    throw new OperationNotAllowedError("User management is not allowed for your role");
  }
};
