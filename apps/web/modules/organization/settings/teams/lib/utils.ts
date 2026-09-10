import { TMember } from "@formbricks/types/memberships";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";

export const isInviteExpired = (invite: TInvite) => {
  const now = new Date();
  const expiresAt = new Date(invite.expiresAt);
  return now > expiresAt;
};

/**
 * Mirrors the server's `getOrganizationOwnerCount`, which every last-owner guard reads: it counts
 * `Membership` rows, and only those whose user can still sign in. Two things are therefore not owners
 * for this purpose, and both used to be counted here:
 *
 * - a pending owner **invite** — it lives in the separate `Invite` table and has no membership row yet,
 *   which is why the parameter is `TMember[]` and not the mixed row list the table renders;
 * - a **deactivated** owner — they can never sign in again, so treating them as a second owner would
 *   leave the organization with nobody who can actually act as one.
 *
 * `accepted` is deliberately not part of this: the server does not filter on it either, and nothing
 * gates organization access on it (see `lib/authzed/organization-membership.ts`).
 */
export const hasMoreThanOneActiveOwner = (members: TMember[]): boolean =>
  members.filter((member) => member.role === "owner" && member.isActive).length > 1;
