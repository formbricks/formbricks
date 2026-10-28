import type { TOrganizationRole } from "@formbricks/types/memberships";
import { isRoleEditDisabled } from "@/modules/ee/role-management/lib/role-edit-rules";

export type TMemberStatus = "active" | "inactive" | "pending" | "expired";

/** One line of the members table: an accepted membership or a pending invite. */
export interface TMemberRow {
  kind: "member" | "invite";
  /** The user id for a member, the invite id for an invite. */
  id: string;
  name: string;
  email: string;
  role: TOrganizationRole;
  status: TMemberStatus;
  /** `null` for an invite (no account yet) and whenever the viewer may not see two-factor state. */
  twoFactorEnabled: boolean | null;
  teamNames: string[];
  /** Invites only: when the invite was sent. */
  invitedAt: Date | null;
}

export interface TMembershipInput {
  userId: string;
  role: TOrganizationRole;
  user: {
    name: string;
    email: string;
    isActive: boolean;
    /** Left out of the query for viewers who are not owner or manager. */
    twoFactorEnabled?: boolean;
    /** Left out of the query for viewers who are not owner or manager. */
    teamUsers?: { team: { name: string } }[];
  };
}

export interface TInviteInput {
  id: string;
  email: string;
  name: string | null;
  role: TOrganizationRole;
  createdAt: Date;
  expiresAt: Date;
  /** Left out of the query for viewers who are not owner or manager. */
  teamIds?: string[];
}

const ROLE_ORDER: Record<TOrganizationRole, number> = { owner: 0, manager: 1, member: 2, billing: 3 };

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** Members first (owners, then managers, members and billing, each by name), pending invites after. */
export const buildMemberRows = ({
  memberships,
  invites,
  teamNameById,
  now,
}: {
  memberships: readonly TMembershipInput[];
  invites: readonly TInviteInput[];
  teamNameById: ReadonlyMap<string, string>;
  now: Date;
}): TMemberRow[] => {
  const members = memberships
    .map<TMemberRow>((membership) => ({
      kind: "member",
      id: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      status: membership.user.isActive ? "active" : "inactive",
      twoFactorEnabled: membership.user.twoFactorEnabled ?? null,
      teamNames: (membership.user.teamUsers ?? []).map(({ team }) => team.name).sort(byName),
      invitedAt: null,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || byName(a.name || a.email, b.name || b.email));

  const pending = invites.map<TMemberRow>((invite) => ({
    kind: "invite",
    id: invite.id,
    name: invite.name ?? "",
    email: invite.email,
    role: invite.role,
    status: invite.expiresAt.getTime() < now.getTime() ? "expired" : "pending",
    twoFactorEnabled: null,
    teamNames: (invite.teamIds ?? []).flatMap((teamId) => teamNameById.get(teamId) ?? []).sort(byName),
    invitedAt: invite.createdAt,
  }));

  return [...members, ...pending];
};

/**
 * Mirrors the server's last-owner guard: only memberships whose user can still sign in count, and a
 * pending owner invite is not a membership.
 */
export const hasMoreThanOneActiveOwner = (rows: readonly TMemberRow[]): boolean =>
  rows.filter((row) => row.kind === "member" && row.role === "owner" && row.status === "active").length > 1;

export interface TMemberRowAccess {
  /** Roles the viewer may move this row to; empty when the role cannot be changed. */
  assignableRoles: TOrganizationRole[];
  canRemove: boolean;
  canReactivate: boolean;
  canResend: boolean;
  canShareLink: boolean;
  canLeave: boolean;
}

export const getAssignableRoles = ({
  currentRole,
  isFormbricksCloud,
}: {
  currentRole: TOrganizationRole;
  isFormbricksCloud: boolean;
}): TOrganizationRole[] => {
  if (currentRole === "owner") {
    return isFormbricksCloud ? ["member", "manager", "owner", "billing"] : ["member", "manager", "owner"];
  }
  // Managers hand out the member role only; the actions refuse anything else.
  return currentRole === "manager" ? ["member"] : [];
};

/**
 * What the viewer may do to one row. The rules are the ones the old members table applied, so the buttons
 * a person sees are the ones the server actions will accept:
 *
 * - `canManageUsers` is owner or manager under `USER_MANAGEMENT_MINIMUM_ROLE`; everything except leaving is
 *   user management.
 * - changing a role also needs the access-control licence (`canEditRoles`), because the action demands it.
 * - nobody removes themselves (they leave), a manager never touches an owner, and the last active owner
 *   stays.
 */
export const getMemberRowAccess = ({
  row,
  currentUserId,
  currentRole,
  canManageUsers,
  canEditRoles,
  isFormbricksCloud,
  isMultiOrgEnabled,
  hasOtherOrganizations,
  doesOrgHaveMoreThanOneOwner,
}: {
  row: TMemberRow;
  currentUserId: string;
  currentRole: TOrganizationRole;
  canManageUsers: boolean;
  canEditRoles: boolean;
  isFormbricksCloud: boolean;
  isMultiOrgEnabled: boolean;
  hasOtherOrganizations: boolean;
  doesOrgHaveMoreThanOneOwner: boolean;
}): TMemberRowAccess => {
  const isInvite = row.kind === "invite";
  const isSelf = !isInvite && row.id === currentUserId;
  const isManagerActingOnOwner = currentRole === "manager" && row.role === "owner";

  const roleEditDisabled = isRoleEditDisabled({
    isUserManagementDisabledFromUi: !canManageUsers,
    currentUserRole: currentRole,
    memberRole: row.role,
    memberId: isInvite ? "" : row.id,
    userId: currentUserId,
    memberAccepted: isInvite ? undefined : true,
    doesOrgHaveMoreThanOneOwner,
  });

  let canRemove = canManageUsers && !isSelf && !isManagerActingOnOwner;
  if (!isInvite && row.role === "owner") {
    canRemove = canRemove && doesOrgHaveMoreThanOneOwner;
  }

  return {
    assignableRoles:
      canEditRoles && !roleEditDisabled ? getAssignableRoles({ currentRole, isFormbricksCloud }) : [],
    canRemove,
    canReactivate: !isInvite && row.status === "inactive" && canManageUsers && !isManagerActingOnOwner,
    canResend: isInvite && canManageUsers,
    canShareLink: isInvite && canManageUsers,
    canLeave: isSelf && currentRole !== "owner" && isMultiOrgEnabled && hasOtherOrganizations,
  };
};
