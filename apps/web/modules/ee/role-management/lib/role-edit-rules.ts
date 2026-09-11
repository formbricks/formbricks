import type { TOrganizationRole } from "@formbricks/types/memberships";

export interface TRoleEditContext {
  isUserManagementDisabledFromUi: boolean;
  currentUserRole: TOrganizationRole;
  memberRole: TOrganizationRole;
  /** The target's user id on membership rows, `""` on invite rows. */
  memberId?: string;
  /** The id of the user doing the editing. */
  userId: string;
  /** `true`/`false` on membership rows, `undefined` on invite rows. */
  memberAccepted?: boolean;
  doesOrgHaveMoreThanOneOwner?: boolean;
}

export const isRoleEditDisabled = ({
  isUserManagementDisabledFromUi,
  currentUserRole,
  memberRole,
  memberId,
  userId,
  memberAccepted,
  doesOrgHaveMoreThanOneOwner,
}: Readonly<TRoleEditContext>): boolean =>
  isUserManagementDisabledFromUi ||
  memberId === userId ||
  // The last-owner rule belongs to memberships, not invites: re-roling a pending owner invite touches
  // no membership, so `updateInviteAction` carries no such guard. `undefined` is the only invite
  // marker — an unaccepted membership row is still a membership, and the server counts it, so testing
  // for `undefined` rather than falsiness keeps this in step with `hasMoreThanOneActiveOwner`.
  (memberAccepted !== undefined && memberRole === "owner" && !doesOrgHaveMoreThanOneOwner) ||
  (currentUserRole === "manager" && memberRole === "owner");
