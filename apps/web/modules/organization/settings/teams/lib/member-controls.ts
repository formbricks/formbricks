import { TMember } from "@formbricks/types/memberships";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";

/**
 * Which row controls the members table offers. They mirror the server: the user-management floor
 * (`canManageUsers`) for everything, managers never on an owner's membership or pending invite, and
 * an organization never left without an active owner (ENG-6812).
 */

/** The two row shapes this table mixes: accepted memberships and pending invites. */
export type TMemberRow = TMember | TInvite;

export const isInvitee = (member: TMemberRow): member is TInvite =>
  (member as TInvite).expiresAt !== undefined;

export const showDeleteButton = (
  member: TMemberRow,
  {
    canManageUsers,
    isManager,
    currentUserId,
    doesOrgHaveMoreThanOneOwner,
  }: Readonly<{
    canManageUsers: boolean;
    isManager: boolean;
    currentUserId: string;
    doesOrgHaveMoreThanOneOwner: boolean;
  }>
): boolean => {
  if (isInvitee(member)) {
    return canActOnInvite(member, { canManageUsers, isManager });
  }

  if (!canManageUsers) {
    return false;
  }

  if (member.userId === currentUserId) {
    return false;
  }

  if (isManager) {
    return member.role !== "owner";
  }

  // A deactivated owner can always go: the active owners are what keeps the organization reachable.
  if (member.role === "owner") {
    return !member.isActive || doesOrgHaveMoreThanOneOwner;
  }

  return true;
};

/** An owner's pending invite is an owner's to delete, share or resend, as the server enforces. */
export const canActOnInvite = (
  invite: TMemberRow,
  { canManageUsers, isManager }: Readonly<{ canManageUsers: boolean; isManager: boolean }>
): boolean => canManageUsers && !(isManager && invite.role === "owner");
