import "server-only";
import { prisma } from "@formbricks/database";
import { lockUserActiveState, reactivateLockedUser } from "@/lib/user/reactivation";

export type TReactivateMemberResult =
  | { status: "reactivated"; reactivatedAt: Date }
  | { status: "already_active" }
  | { status: "not_member" }
  | { status: "owner_needs_owner" }
  | { status: "in_other_organizations" };

/**
 * Reactivate a member the members policy (or anyone) deactivated, from one organisation's member list.
 *
 * `isActive` covers the whole account, so only someone who belongs to this organisation alone can be
 * reactivated from it: for a member of several, this organisation would be deciding for the others. The
 * policy never deactivates such members either, so this mirrors it (decided 7 Oct). Reactivating
 * restarts their retention clock and clears their members notice (`reactivateLockedUser`, shared with
 * the v2 users API), so a later lapse gets a fresh notice and a full warning. User management, so it
 * needs no data retention licence: someone deactivated while the organisation held one can always be
 * brought back.
 *
 * Only an owner can reactivate an owner: managers don't act on owners anywhere else either (role
 * changes, removal).
 *
 * The user row is locked `FOR UPDATE` (`lockUserActiveState`), which orders this against other
 * reactivations and deactivations and also against a membership being added meanwhile: that insert
 * takes `FOR KEY SHARE` on the same row through its foreign key, so it either lands first and is counted,
 * or waits. A weaker lock (`FOR NO KEY UPDATE`) would let it through.
 */
export async function reactivateRetentionMember({
  userId,
  organizationId,
  actorUserId,
}: {
  userId: string;
  organizationId: string;
  /** Who is reactivating: an owner may reactivate anyone, a manager anyone but an owner. */
  actorUserId: string;
}): Promise<TReactivateMemberResult> {
  return prisma.$transaction(async (tx) => {
    const user = await lockUserActiveState(tx, userId);
    if (!user) return { status: "not_member" };

    const memberships = await tx.membership.findMany({
      where: { userId },
      select: { organizationId: true, role: true },
    });
    const membership = memberships.find((candidate) => candidate.organizationId === organizationId);
    if (!membership) return { status: "not_member" };
    if (membership.role === "owner" && userId !== actorUserId) {
      const actor = await tx.membership.findUnique({
        where: { userId_organizationId: { userId: actorUserId, organizationId } },
        select: { role: true },
      });
      if (actor?.role !== "owner") return { status: "owner_needs_owner" };
    }
    // Nothing to do for someone already active, wherever else they belong.
    if (user.isActive) return { status: "already_active" };
    if (memberships.length > 1) return { status: "in_other_organizations" };

    return { status: "reactivated", reactivatedAt: await reactivateLockedUser(tx, userId) };
  });
}
