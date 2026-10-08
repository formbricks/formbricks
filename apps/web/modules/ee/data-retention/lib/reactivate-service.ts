import "server-only";
import { prisma } from "@formbricks/database";

export type TReactivateMemberResult =
  | { status: "reactivated"; reactivatedAt: Date }
  | { status: "already_active" }
  | { status: "not_member" }
  | { status: "in_other_organizations" };

/**
 * Reactivate a member the members policy (or anyone) deactivated, from one organisation's member list.
 *
 * `isActive` covers the whole account, so only someone who belongs to this organisation alone can be
 * reactivated from it: for a member of several, this organisation would be deciding for the others. The
 * policy never deactivates such members either, so this mirrors it (decided 7 Oct). Reactivating
 * restarts their retention clock (`reactivatedAt`) and clears this organisation's members notice, so a
 * later lapse gets a fresh notice and a full warning. The `User.isActive` change reaches SpiceDB through
 * the projection outbox trigger on the column.
 *
 * The user row is locked, so two reactivations, or one racing a deactivation, apply in order.
 */
export async function reactivateRetentionMember({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}): Promise<TReactivateMemberResult> {
  return prisma.$transaction(async (tx) => {
    const [user] = await tx.$queryRaw<{ isActive: boolean }[]>`
      SELECT "isActive" FROM "User" WHERE "id" = ${userId} FOR UPDATE
    `;
    if (!user) return { status: "not_member" };

    const memberships = await tx.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    if (!memberships.some((membership) => membership.organizationId === organizationId)) {
      return { status: "not_member" };
    }
    // Nothing to do for someone already active, wherever else they belong.
    if (user.isActive) return { status: "already_active" };
    if (memberships.length > 1) return { status: "in_other_organizations" };

    // The database's clock, like the notice times the members clock is compared with; the stored value
    // is returned, since the column keeps milliseconds.
    const now = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`)[0].now;
    const { reactivatedAt } = await tx.user.update({
      where: { id: userId },
      data: { isActive: true, reactivatedAt: now },
      select: { reactivatedAt: true },
    });
    await tx.retentionNotice.deleteMany({ where: { userId, organizationId, entity: "members" } });
    return { status: "reactivated", reactivatedAt: reactivatedAt ?? now };
  });
}
