import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  deleteMcpGrantRelationshipsBeforeCommit,
  reconcileMcpGrantRelationships,
  removeDeletedMcpGrantRelationships,
} from "@/lib/authzed/mcp-grant";
import { queueAuthzedOutboxEvents } from "@/lib/authzed/outbox-repository";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { loggableError } from "@/lib/utils/loggable-error";
import { type TMcpGrantSelectionResolution, resolveMcpGrantSelection } from "./access-options";
import {
  MCP_GRANT_ACCESS_SELECT,
  type TMcpGrantAccessRow,
  type TMcpGrantAccessSelection,
  type TMcpGrantPermissions,
  parseMcpGrantPermissions,
  readMcpGrantAccessSelection,
} from "./grant";
import { getMcpGrantSelectedIds } from "./grant-access";

/**
 * Where grants live (ADR-0041): one `McpGrant` row per user and MCP client. Saving and deleting take the
 * caller's transaction, so a grant is written and removed together with the consent it belongs to.
 *
 * The organization & workspace selections (`McpGrantOrganization`, `McpGrantWorkspace`) are written in the
 * same transaction. Their triggers queue the grant for the SpiceDB projection (`lib/authzed/mcp-grant.ts`,
 * ADR-0042), so the relationships follow the rows through the outbox, and a cascade from a deleted
 * workspace, organization or grant drops them too. On top of that, each change is applied to SpiceDB
 * synchronously, ordered so the safe direction wins:
 *
 *  - Narrowing a grant that stays (consent re-approval, Edit) deletes what it takes away inside the
 *    transaction, while it holds the grant's row `FOR UPDATE`, once nothing can refuse the save any more
 *    ({@link narrowMcpGrantAccess}; the consent hook resolves first and applies after its checks,
 *    {@link applyMcpGrantNarrowing}). A failure fails the change. The workspaces the user may select are
 *    looked up in SpiceDB before the transaction, never while it holds a lock.
 *  - What a save adds is written once it has committed ({@link projectMcpGrants}), best-effort.
 *  - Deleting a grant needs no SpiceDB call to take effect: `/api/mcp` refuses a request whose user and
 *    client have no grant row. The relationships are removed once the delete has committed
 *    ({@link removeDeletedMcpGrants}), best-effort.
 *
 * The outbox event is the repair for both best-effort writes. Every path that locks a grant row and
 * consent rows takes the grant first, so they wait on each other rather than deadlock. A path that also
 * locks the user's row takes it before both (a member removal takes the organization's owners even
 * before that), including a consent approval, whose new grant row's foreign key would otherwise lock it
 * last.
 *
 * Audit entries for grant changes live in `grant-audit.ts`.
 */

/**
 * A grant as stored, with what an audit entry names it by, and its organization & workspace access with
 * what that selects: organizations for Only selected organizations, workspaces for Only selected
 * workspaces, nothing for All access.
 */
export type TStoredMcpGrant = TMcpGrantAccessSelection & {
  id: string;
  userId: string;
  clientId: string;
  permissions: TMcpGrantPermissions;
};

const GRANT_SELECT = {
  id: true,
  userId: true,
  clientId: true,
  permissions: true,
  ...MCP_GRANT_ACCESS_SELECT,
} as const;

/** A row as `GRANT_SELECT` reads it. */
type TGrantRow = TMcpGrantAccessRow & { id: string; userId: string; clientId: string; permissions: unknown };

const toStoredGrant = (
  row: TGrantRow,
  access: TMcpGrantAccessSelection = readMcpGrantAccessSelection(row)
): TStoredMcpGrant => ({
  id: row.id,
  userId: row.userId,
  clientId: row.clientId,
  permissions: parseMcpGrantPermissions(row.permissions),
  ...access,
});

/** The user's grant to the MCP client, or `null` when it has none. */
export const getMcpGrant = async (userId: string, clientId: string): Promise<TStoredMcpGrant | null> => {
  const row = await prisma.mcpGrant.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: GRANT_SELECT,
  });
  return row ? toStoredGrant(row) : null;
};

/**
 * Whether the user has a grant to the MCP client, read in the caller's transaction without a lock. For a
 * read after the caller already locked consent rows, where taking the grant's lock would invert the order.
 */
export const hasMcpGrant = async (
  tx: Prisma.TransactionClient,
  { userId, clientId }: { userId: string; clientId: string }
): Promise<boolean> =>
  (await tx.mcpGrant.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { id: true },
  })) !== null;

/**
 * Locks the user's grant to the MCP client `FOR SHARE`, and says whether it has one. For a path that must
 * take the grant's lock before consent rows without changing the grant (the refresh check, restoring a
 * consent after a failed approval): it waits on a save or revoke in flight, and they wait on it.
 */
export const shareLockMcpGrant = async (
  tx: Prisma.TransactionClient,
  { userId, clientId }: { userId: string; clientId: string }
): Promise<boolean> => {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "McpGrant" WHERE "userId" = ${userId} AND "clientId" = ${clientId} FOR SHARE`;
  return rows.length > 0;
};

/**
 * Locks the user's grant to the MCP client `FOR UPDATE` and reads it; `null` when there is none. The first
 * step of every save: it serializes the save with a revoke, another save, and the reconciling projection
 * (which reads grants `FOR SHARE`). Take it before the consent rows.
 */
export const lockMcpGrant = async (
  tx: Prisma.TransactionClient,
  { userId, clientId }: { userId: string; clientId: string }
): Promise<TStoredMcpGrant | null> => {
  const [locked] = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "McpGrant" WHERE "userId" = ${userId} AND "clientId" = ${clientId} FOR UPDATE`;
  if (!locked) return null;
  return toStoredGrant(
    await tx.mcpGrant.findUniqueOrThrow({ where: { id: locked.id }, select: GRANT_SELECT })
  );
};

/**
 * The second step of a save that names an organization & workspace access, after {@link lockMcpGrant}:
 * resolves the access to save by the rule the consent screen and Edit share
 * (`resolveMcpGrantSelection`), and deletes from SpiceDB what it takes away from the grant `before`, now,
 * so the narrowing applies on the client's next call or the save fails. `readableWorkspaceIds` is what
 * `readMcpGrantReadableWorkspaceIds` read for `access` before the transaction began, so the only SpiceDB
 * call here is that delete. Run it before locking any consent row. Writes nothing to PostgreSQL;
 * {@link writeMcpGrant} does.
 */
export const narrowMcpGrantAccess = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    before: TStoredMcpGrant | null;
    access: TMcpGrantAccessSelection;
    readableWorkspaceIds: ReadonlySet<string>;
  }
): Promise<TMcpGrantSelectionResolution> => {
  const resolved = await resolveMcpGrantNarrowing(tx, input);
  if (resolved.status === "ok") await applyMcpGrantNarrowing(input.before, resolved.access);
  return resolved;
};

/**
 * The checking half of {@link narrowMcpGrantAccess}: resolves the access to save, with no SpiceDB call. A
 * save that can still refuse after this (the consent hook, whose cap comes from consent rows it locks
 * later) resolves first, checks everything else, and only then applies the narrowing
 * ({@link applyMcpGrantNarrowing}): a refusal after the SpiceDB delete would commit unchanged rows over
 * relationships that no longer match them, and nothing would repair it.
 */
export const resolveMcpGrantNarrowing = (
  tx: Prisma.TransactionClient,
  {
    userId,
    before,
    access,
    readableWorkspaceIds,
  }: {
    userId: string;
    before: TStoredMcpGrant | null;
    access: TMcpGrantAccessSelection;
    readableWorkspaceIds: ReadonlySet<string>;
  }
): Promise<TMcpGrantSelectionResolution> =>
  resolveMcpGrantSelection(tx, userId, access, before, readableWorkspaceIds);

/**
 * The applying half of {@link narrowMcpGrantAccess}: deletes from SpiceDB what `access` takes away from
 * the grant `before` (nothing for a new grant). Call it in the save's transaction once nothing can refuse
 * the save any more, right before {@link writeMcpGrant}. A failure throws and fails the save.
 */
export const applyMcpGrantNarrowing = async (
  before: TStoredMcpGrant | null,
  access: TMcpGrantAccessSelection
): Promise<void> => {
  if (before) await deleteMcpGrantRelationshipsBeforeCommit(before, access);
};

/**
 * Locks the user's row `FOR KEY SHARE`, the lock a new grant row's foreign key takes anyway, ahead of any
 * grant or consent row. A path that changes what the user may hold (a member removal, a demotion) takes the
 * row `FOR UPDATE` first and their grant and consent rows after, so the two wait on each other instead of
 * deadlocking. `FOR KEY SHARE` does not wait on a sign-in's `FOR NO KEY UPDATE` (`lastLoginAt`).
 *
 * A path that writes a grant without holding a row to lock (`createMcpGrantIfMissing`) takes it to order
 * its insert against a revocation that marks first and deletes after: the revocation takes the row
 * `FOR UPDATE`, which waits on a writer's `FOR KEY SHARE`.
 */
export const lockUserForMcpGrantWrite = async (
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> => {
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR KEY SHARE`;
};

/**
 * Locks the user's row `FOR UPDATE`, the waiting side of {@link lockUserForMcpGrantWrite}: a revocation
 * takes it before it deletes, so a grant it wrote before the lock is deleted with the rest, and one written
 * after (a code exchange whose claim re-reads the mark once it holds the row) sees the revocation's mark.
 */
export const lockUserForMcpRevocation = async (
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> => {
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
};

/**
 * Replaces the grant's selection rows with what `access` selects: deletes the rows no longer selected
 * (every row of the other kind included) and inserts the new ones, so an unchanged selection writes
 * nothing and queues no projection.
 */
const replaceSelection = async (
  tx: Prisma.TransactionClient,
  grantId: string,
  access: TMcpGrantAccessSelection
): Promise<void> => {
  const selected = getMcpGrantSelectedIds(access);
  await tx.mcpGrantOrganization.deleteMany({
    where: { grantId, organizationId: { notIn: selected.organizationIds } },
  });
  await tx.mcpGrantWorkspace.deleteMany({
    where: { grantId, workspaceId: { notIn: selected.workspaceIds } },
  });
  if (selected.organizationIds.length > 0) {
    await tx.mcpGrantOrganization.createMany({
      data: selected.organizationIds.map((organizationId) => ({ grantId, organizationId })),
      skipDuplicates: true,
    });
  }
  if (selected.workspaceIds.length > 0) {
    await tx.mcpGrantWorkspace.createMany({
      data: selected.workspaceIds.map((workspaceId) => ({ grantId, workspaceId })),
      skipDuplicates: true,
    });
  }
};

/**
 * The last step of a save: writes the grant's `permissions` and, when given, the organization & workspace
 * access {@link narrowMcpGrantAccess} resolved. Without `access` an existing grant keeps the access it has
 * and a new one gets All access, so a request that says nothing about it never widens it. `before` is what
 * {@link lockMcpGrant} read. Returns the grant before (`null` when created) and after, for the audit entry.
 */
export const writeMcpGrant = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    before,
    permissions,
    access,
  }: {
    userId: string;
    clientId: string;
    before: TStoredMcpGrant | null;
    permissions: TMcpGrantPermissions;
    access?: TMcpGrantAccessSelection;
  }
): Promise<{ before: TStoredMcpGrant | null; after: TStoredMcpGrant }> => {
  const mode = access?.access ?? before?.access ?? "all";
  const row = await tx.mcpGrant.upsert({
    where: { userId_clientId: { userId, clientId } },
    create: { userId, clientId, access: mode, permissions },
    // `access` only when it changes: the column's trigger queues a projection, and a no-op does not.
    update: { permissions, ...(before?.access === mode ? {} : { access: mode }) },
    select: GRANT_SELECT,
  });
  if (!access) return { before, after: toStoredGrant(row) };
  await replaceSelection(tx, row.id, access);
  return { before, after: toStoredGrant(row, access) };
};

/**
 * Gives the user's MCP client a grant with All access and `permissions`, unless it has one: a grant the
 * user already has, or narrowed, is never reset. Returns the grant when this created it, `null` otherwise.
 * One insert that skips an existing (user, client) row, so two tokens issued at once create one grant.
 *
 * Takes the caller's transaction so an insert can be ordered against a revocation: called after
 * {@link lockUserForMcpGrantWrite}, a revocation that marked first is seen before it and deletes the
 * grant after it, never the other way round.
 */
export const createMcpGrantIfMissing = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    permissions,
  }: {
    userId: string;
    clientId: string;
    permissions: TMcpGrantPermissions;
  }
): Promise<TStoredMcpGrant | null> => {
  const { count } = await tx.mcpGrant.createMany({
    data: [{ userId, clientId, access: "all", permissions }],
    skipDuplicates: true,
  });
  if (count !== 1) return null;
  const row = await tx.mcpGrant.findUniqueOrThrow({
    where: { userId_clientId: { userId, clientId } },
    select: GRANT_SELECT,
  });
  return toStoredGrant(row);
};

/**
 * Deletes the user's grants: the one for `clientId`, or every one the user holds when it is omitted. The
 * rows are locked `FOR UPDATE` in id order first, as every other multi-row path here takes them. Makes no
 * SpiceDB call: the deleted row is what ends the client's access. Returns what was deleted, for the audit
 * entries and for {@link removeDeletedMcpGrants} once the caller's transaction has committed.
 */
export const deleteMcpGrants = async (
  tx: Prisma.TransactionClient,
  { userId, clientId }: { userId: string; clientId?: string }
): Promise<TStoredMcpGrant[]> => {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "McpGrant"
    WHERE "userId" = ${userId} AND (${clientId ?? null}::text IS NULL OR "clientId" = ${clientId ?? null})
    ORDER BY "id"
    FOR UPDATE`;
  if (locked.length === 0) return [];
  const ids = locked.map(({ id }) => id);
  const rows = await tx.mcpGrant.findMany({
    where: { id: { in: ids } },
    select: GRANT_SELECT,
    orderBy: { id: "asc" },
  });
  await tx.mcpGrant.deleteMany({ where: { id: { in: ids } } });
  return rows.map((row) => toStoredGrant(row));
};

/**
 * Removes the SpiceDB relationships of grants {@link deleteMcpGrants} deleted. Call it once the deleting
 * transaction has committed, never inside it. Best-effort and never throws: the deleted rows already end
 * the clients' access, and the outbox event the delete queued is the repair.
 */
export const removeDeletedMcpGrants = async (grants: ReadonlyArray<TStoredMcpGrant>): Promise<void> => {
  if (grants.length === 0) return;
  await runPostCommitProjection("mcp_grant_post_commit_removal", () =>
    removeDeletedMcpGrantRelationships(grants)
  );
};

/**
 * Writes the grants' organization & workspace access to SpiceDB now, after the transaction that changed
 * them has committed: a narrowed grant must not keep its old reach until the outbox delivers (spec story
 * 32), and a widened one should not wait for it either. Call it after the commit, never inside the
 * transaction, or SpiceDB could hold a selection that then rolls back.
 *
 * Never throws: the change is committed, and the outbox event its rows queued is the durable repair.
 * Reconciling is idempotent, so that later delivery is harmless. A failure is logged by the projection.
 */
export const projectMcpGrants = async (grantIds: ReadonlyArray<string>): Promise<void> => {
  if (grantIds.length === 0) return;
  await runPostCommitProjection("mcp_grant_post_commit_reconciliation", () =>
    reconcileMcpGrantRelationships({ grantIds })
  );
};

/**
 * Repairs grants after a save that may have narrowed them in SpiceDB and then failed to commit: a consent
 * approval or an Edit deletes what a narrowing removes before its transaction commits, so a rollback leaves
 * SpiceDB narrower than the rows still say, and the outbox event those rows would have queued rolled back
 * with it.
 *
 * Queues an outbox event per grant first, in a write of its own that commits whatever happens next: the
 * durable repair, which the worker delivers until it succeeds. Then reconciles now, best-effort, so the
 * client gets its access back without waiting for the worker. Never throws; the caller is already failing.
 */
export const repairMcpGrantsAfterFailedSave = async (grantIds: ReadonlyArray<string>): Promise<void> => {
  if (grantIds.length === 0) return;
  try {
    await queueAuthzedOutboxEvents("mcp_grant", grantIds);
  } catch (error) {
    logger.error(
      { err: loggableError(error), grants: grantIds.length },
      "Queueing the repair of MCP grants after a failed save failed"
    );
  }
  await projectMcpGrants(grantIds);
};

/** A stored grant's organization & workspace access with what it selects, apart from its other fields. */
export const getMcpGrantAccessSelection = (grant: TStoredMcpGrant): TMcpGrantAccessSelection => {
  const { id: _id, userId: _userId, clientId: _clientId, permissions: _permissions, ...access } = grant;
  return access;
};

export {
  MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS,
  MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS,
} from "@/lib/authzed/mcp-grant-timeouts";
