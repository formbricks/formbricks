import "server-only";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";

/**
 * `USER_MANAGEMENT_MINIMUM_ROLE=disabled` turns user management off for everyone, an owner included.
 *
 * Owners and managers already get that through `canManageUsers` (`organization.manage_access`, which the
 * evaluator denies at `disabled`). A team admin inviting into their own teams is decided by `team.manage`
 * instead: they are plain members, below every `owner` / `manager` floor by definition, so the floor's
 * role ranking cannot reach them. `disabled` is the one floor value that still applies to them (ENG-7376),
 * and this is where it is asked. Its own module, so the many importers of `user-management.ts` do not
 * load the constants.
 */
export const isUserManagementDisabled = (): boolean => USER_MANAGEMENT_MINIMUM_ROLE === "disabled";
