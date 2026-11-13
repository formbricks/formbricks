import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { retryOnTransactionConflict } from "@/lib/utils/prisma-error";

/**
 * The organization keeps at least one active owner. A path that can demote, deactivate or remove a member
 * checks it in the transaction that makes the change, under a lock on the organization's owner
 * memberships, taken before any user row. This module only exports the check together with that lock, so a
 * caller cannot run the check without it. `countActiveOwners` alone never guards a write: the sweep uses it
 * only to decide whom to warn.
 *
 * - `runOwnerGuardedTransaction` opens the transaction itself: the v2 users API, removing a member, and
 *   demoting an owner from the member list;
 * - `lockOwnersAndCheckRemoval` is for a caller that opens its own: the data retention members sweep.
 *
 * Account deletion does not go through it yet (ENG-7204).
 */

/** Thrown by `runOwnerGuardedTransaction` when the change would leave the organization with no active owner. */
export class LastActiveOwnerError extends Error {
  constructor() {
    super("Cannot remove the last active owner of the organization");
  }
}

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
 * of them cannot both pass the check. Serializable isolation alone does not give this: Postgres only
 * detects the clash between two Serializable transactions, and a Serializable transaction that waits here
 * still reads from the snapshot it took before waiting.
 */
const lockOrganizationOwners = async (tx: Prisma.TransactionClient, organizationId: string) => {
  await tx.$queryRaw`
    SELECT 1 FROM "Membership"
    WHERE "organizationId" = ${organizationId} AND "role" = 'owner'
    ORDER BY "userId"
    FOR UPDATE
  `;
};

/**
 * Takes the owners' lock, then says whether taking `userId` out of the organization's active owners would
 * leave it with none. A member who is not an active owner (a non-owner, or an owner already deactivated)
 * is not in the count, so changing them never trips it.
 *
 * Call it first in the transaction, before any user row is locked: every guarded path takes the owners
 * first, so they never deadlock with each other.
 */
export const lockOwnersAndCheckRemoval = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string
): Promise<boolean> => {
  await lockOrganizationOwners(tx, organizationId);
  const target = await tx.membership.findUnique({
    where: { userId_organizationId: { organizationId, userId } },
    select: { role: true, user: { select: { isActive: true } } },
  });
  if (target?.role !== "owner" || !target.user.isActive) return false;
  return (await countActiveOwners(tx, organizationId)) <= 1;
};

/**
 * Runs `transaction`, first refusing with `LastActiveOwnerError` when it would take the last active owner
 * out of the organization. Pass the member it may remove, or `null` when the change cannot remove an owner:
 * then no lock is taken. Run again when Postgres aborts it over a deadlock (with a path that takes the user
 * row first, such as account deletion), so keep `transaction` idempotent: every attempt re-reads and
 * re-writes from scratch.
 */
export const runOwnerGuardedTransaction = <T>(
  organizationId: string,
  removedUserId: string | null,
  transaction: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> =>
  retryOnTransactionConflict(() =>
    prisma.$transaction(async (tx) => {
      if (removedUserId !== null && (await lockOwnersAndCheckRemoval(tx, organizationId, removedUserId))) {
        throw new LastActiveOwnerError();
      }
      return transaction(tx);
    })
  );
