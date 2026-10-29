import type { TOrganizationRole } from "@formbricks/types/memberships";

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

export interface TMemberRowActions {
  /** A pending invite the viewer manages: they can copy its link (a credential, so never the agent). */
  canShareLink: boolean;
  /** The viewer's own row, when leaving is allowed: not the owner, with more than one organization. */
  canLeave: boolean;
}

/**
 * What the viewer may still do to one row by hand. Everything else about members (roles, removal, resending
 * and deleting invites) is an agent tool now, so the rules that used to live here are the operations' own.
 * The rules for the two that remain are the old ones, and match what their server actions accept:
 *
 * - copying an invite link is user management (`canManageUsers`), for invites only;
 * - leaving is for the viewer's own row, never for an owner (an owner deletes the organization instead),
 *   and only when they belong to another organization and the instance allows more than one.
 */
export const getMemberRowActions = ({
  row,
  currentUserId,
  currentRole,
  canManageUsers,
  isMultiOrgEnabled,
  hasOtherOrganizations,
}: {
  row: TMemberRow;
  currentUserId: string;
  currentRole: TOrganizationRole;
  canManageUsers: boolean;
  isMultiOrgEnabled: boolean;
  hasOtherOrganizations: boolean;
}): TMemberRowActions => ({
  canShareLink: row.kind === "invite" && canManageUsers,
  canLeave:
    row.kind === "member" &&
    row.id === currentUserId &&
    currentRole !== "owner" &&
    isMultiOrgEnabled &&
    hasOtherOrganizations,
});
