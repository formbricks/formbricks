import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";

/**
 * The organization keeps at least one active owner. Every path that can demote, deactivate or remove a
 * member enforces it the same way, in the transaction that makes the change:
 *
 * 1. `lockOrganizationOwners` first, before any user row;
 * 2. `wouldRemoveLastActiveOwner` for the member being changed;
 * 3. the write.
 *
 * The paths: the v2 users API (`updateUser`), removing a member (`deleteMembership`), the role change in the
 * member list (`updateMembershipAction`) and the data retention members sweep (`deactivateDueMember`).
 */

/**
 * Owners whose account is active. A deactivated user can never sign in again (see modules/auth/lib/session.ts
 * and better-auth-active-user-gate.ts), so counting them as "another owner" would let a guard pass while
 * leaving the organization with no owner who can actually log in.
 */
export const countActiveOwners = (
  client: Prisma.TransactionClient,
  organizationId: string
): Promise<number> =>
  client.membership.count({ where: { organizationId, role: "owner", user: { isActive: true } } });

/**
 * Locks the organization's owner memberships until `tx` ends, in a fixed order. A second transaction that
 * takes it waits here, and at Read Committed its next statement then sees the first one's change, so two
 * of them cannot both pass the last-owner check. Serializable isolation alone does not give this: Postgres
 * only detects the clash between two Serializable transactions, and a Serializable transaction that waits
 * here still reads from the snapshot it took before waiting. Taken before the user row, in the same order
 * on every path, so they never deadlock with each other.
 */
export const lockOrganizationOwners = async (
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<void> => {
  await tx.$queryRaw`
    SELECT 1 FROM "Membership"
    WHERE "organizationId" = ${organizationId} AND "role" = 'owner'
    ORDER BY "userId"
    FOR UPDATE
  `;
};

/**
 * Whether taking `userId` out of the organization's active owners would leave it with none. Call it after
 * `lockOrganizationOwners`, so the member and the count are read after any other owner change has
 * committed. A member who is not an active owner (a non-owner, or an owner already deactivated) is not in
 * the count, so changing them never trips it.
 */
export const wouldRemoveLastActiveOwner = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string
): Promise<boolean> => {
  const target = await tx.membership.findUnique({
    where: { userId_organizationId: { organizationId, userId } },
    select: { role: true, user: { select: { isActive: true } } },
  });
  if (target?.role !== "owner" || !target.user.isActive) return false;
  return (await countActiveOwners(tx, organizationId)) <= 1;
};

/**
 * One transaction holding the organization's owner lock, run again when Postgres aborts it over a
 * deadlock (with a path that takes the user row first, such as account deletion). The retry and the
 * conflict check live in `prisma-error`, so a driver adapter's own conflict error is retried as well as
 * Prisma's P2034. Keep `transaction` idempotent: every attempt re-reads and re-writes from scratch.
 */
export const runOwnerLockedTransaction = <T>(
  organizationId: string,
  transaction: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      await lockOrganizationOwners(tx, organizationId);
      return transaction(tx);
    })
  );
