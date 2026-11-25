import "server-only";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";

/**
 * `USER_MANAGEMENT_MINIMUM_ROLE=disabled` turns user management off for everyone, an owner included.
 *
 * Owners and managers already get that through `canManageUsers` (`organization.manage_access`, which the
 * evaluator denies at `disabled`). A team admin inviting into their own teams is decided by `team.manage`
 * instead: they are plain members, below every `owner` / `manager` floor by definition, so the floor's
 * role ranking cannot reach them. `disabled` is the one floor value that still applies to them (ENG-7376).
 */
export const isUserManagementDisabled = (): boolean => USER_MANAGEMENT_MINIMUM_ROLE === "disabled";

/**
 * Whether a team admin who is neither owner nor manager may invite into their own teams: Access Control
 * licensed, and user management not disabled. `POST /api/internal/invites` decides the same; the teams page
 * asks this on the server so the invite controls are offered exactly where the route accepts them.
 */
export const canTeamAdminInvite = ({
  isAccessControlAllowed,
  isTeamAdmin,
}: {
  isAccessControlAllowed: boolean;
  isTeamAdmin: boolean;
}): boolean => isAccessControlAllowed && isTeamAdmin && !isUserManagementDisabled();

/**
 * Whether the invite controls belong to this caller, by the two paths `POST /api/internal/invites` takes:
 * an owner or manager invites as the organization, which the role floor decides (`canManageUsers`); anyone
 * else only as a team admin ({@link canTeamAdminInvite}). Asked on the server; the client never recomputes it.
 */
export const canInviteMembers = ({
  isOwnerOrManager,
  canManageUsers,
  isAccessControlAllowed,
  isTeamAdmin,
}: {
  isOwnerOrManager: boolean;
  canManageUsers: boolean;
  isAccessControlAllowed: boolean;
  isTeamAdmin: boolean;
}): boolean =>
  isOwnerOrManager ? canManageUsers : canTeamAdminInvite({ isAccessControlAllowed, isTeamAdmin });
