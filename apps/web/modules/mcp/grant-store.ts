import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  deleteMcpGrantRelationshipsBeforeCommit,
  reconcileMcpGrantRelationships,
  removeDeletedMcpGrantRelationships,
} from "@/lib/authzed/mcp-grant";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { loggableError } from "@/lib/utils/loggable-error";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { type TActor, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
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
import { MCP_PERMISSIONS, type TMcpPermission } from "./permissions";

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
 *    transaction, while it holds the grant's row `FOR UPDATE` and before it locks any consent row
 *    ({@link narrowMcpGrantAccess}). A failure fails the change.
 *  - What a save adds is written once it has committed ({@link projectMcpGrants}), best-effort.
 *  - Deleting a grant needs no SpiceDB call to take effect: `/api/mcp` refuses a request whose user and
 *    client have no grant row. The relationships are removed once the delete has committed
 *    ({@link removeDeletedMcpGrants}), best-effort.
 *
 * The outbox event is the repair for both best-effort writes. Every path that locks a grant row and
 * consent rows takes the grant first, so they wait on each other rather than deadlock.
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

/** Whether the user has a grant to the MCP client, read in the caller's transaction. */
export const hasMcpGrant = async (
  tx: Prisma.TransactionClient,
  { userId, clientId }: { userId: string; clientId: string }
): Promise<boolean> =>
  (await tx.mcpGrant.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { id: true },
  })) !== null;

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
 * so the narrowing applies on the client's next call or the save fails. Makes SpiceDB calls: run it before
 * locking any consent row. Writes nothing to PostgreSQL; {@link writeMcpGrant} does.
 */
export const narrowMcpGrantAccess = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    before,
    access,
  }: { userId: string; before: TStoredMcpGrant | null; access: TMcpGrantAccessSelection }
): Promise<TMcpGrantSelectionResolution> => {
  const resolved = await resolveMcpGrantSelection(tx, userId, access, before);
  if (resolved.status === "ok" && before)
    await deleteMcpGrantRelationshipsBeforeCommit(before, resolved.access);
  return resolved;
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
 */
export const createMcpGrantIfMissing = async ({
  userId,
  clientId,
  permissions,
}: {
  userId: string;
  clientId: string;
  permissions: TMcpGrantPermissions;
}): Promise<TStoredMcpGrant | null> => {
  const { count } = await prisma.mcpGrant.createMany({
    data: [{ userId, clientId, access: "all", permissions }],
    skipDuplicates: true,
  });
  return count === 1 ? getMcpGrant(userId, clientId) : null;
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

/** A stored grant's organization & workspace access with what it selects, apart from its other fields. */
export const getMcpGrantAccessSelection = (grant: TStoredMcpGrant): TMcpGrantAccessSelection => {
  const { id: _id, userId: _userId, clientId: _clientId, permissions: _permissions, ...access } = grant;
  return access;
};

/**
 * What an audit entry records of a grant: the client, its organization & workspace access with what that
 * selects, and every permission's level, No access included. Every permission is spelled out so that a
 * permission taken away shows as a change to `none`, not as a key that silently disappeared.
 */
export const getMcpGrantAuditSnapshot = (grant: TStoredMcpGrant) => ({
  clientId: grant.clientId,
  ...getMcpGrantAccessSelection(grant),
  permissions: Object.fromEntries(
    (Object.keys(MCP_PERMISSIONS) as TMcpPermission[]).map((permission) => [
      permission,
      grant.permissions[permission] ?? "none",
    ])
  ),
});

type TMcpGrantAuditAction = "created" | "updated" | "deleted";

/**
 * One grant change, ready to audit: what changed, the organizations its entries are filed under, and the
 * organization of each workspace it selects, so each entry carries only its own organization's part.
 */
export type TMcpGrantAuditRecord = {
  action: TMcpGrantAuditAction;
  before: TStoredMcpGrant | null;
  after: TStoredMcpGrant | null;
  organizationIds: string[];
  workspaceOrganizationIds: Readonly<Record<string, string>>;
};

type TAuditReader = Pick<Prisma.TransactionClient, "membership" | "workspace">;

/**
 * The organizations each change's audit entries are filed under, so an organization owner finds them
 * among their organization's entries (spec story 39): those the grant reaches before or after the
 * change. Only selected organizations reaches its organizations; Only selected workspaces, their
 * organizations; All access, every organization the user belongs to. Two reads whatever the count.
 */
export const prepareMcpGrantAudits = async (
  db: TAuditReader,
  changes: ReadonlyArray<Omit<TMcpGrantAuditRecord, "organizationIds" | "workspaceOrganizationIds">>
): Promise<TMcpGrantAuditRecord[]> => {
  const grants = changes.flatMap(({ before, after }) => [before, after]).filter((grant) => grant !== null);
  const allAccessUserIds = [
    ...new Set(grants.filter(({ access }) => access === "all").map(({ userId }) => userId)),
  ];
  const workspaceIds = [
    ...new Set(grants.flatMap((grant) => (grant.access === "workspaces" ? grant.workspaceIds : []))),
  ];
  const [memberships, workspaces] = await Promise.all([
    allAccessUserIds.length > 0
      ? db.membership.findMany({
          where: { userId: { in: allAccessUserIds } },
          select: { userId: true, organizationId: true },
        })
      : [],
    workspaceIds.length > 0
      ? db.workspace.findMany({
          where: { id: { in: workspaceIds } },
          select: { id: true, organizationId: true },
        })
      : [],
  ]);
  const organizationOf = new Map(workspaces.map(({ id, organizationId }) => [id, organizationId]));
  const reached = (grant: TStoredMcpGrant): string[] => {
    switch (grant.access) {
      case "all":
        return memberships.filter(({ userId }) => userId === grant.userId).map((m) => m.organizationId);
      case "organizations":
        return grant.organizationIds;
      case "workspaces":
        return grant.workspaceIds.flatMap((id) => organizationOf.get(id) ?? []);
    }
  };
  return changes.map((change) => {
    const grants = [change.before, change.after].filter((grant) => grant !== null);
    return {
      ...change,
      organizationIds: [...new Set(grants.flatMap(reached))].sort((a, b) => a.localeCompare(b)),
      workspaceOrganizationIds: Object.fromEntries(
        grants.flatMap((grant) =>
          getMcpGrantSelectedIds(grant).workspaceIds.flatMap((id) => {
            const organizationId = organizationOf.get(id);
            return organizationId ? [[id, organizationId] as const] : [];
          })
        )
      ),
    };
  });
};

/**
 * The part of a grant's snapshot an entry filed under `organizationId` may carry: the selection's ids in
 * that organization, never another one's, which the organization's owners have no business reading.
 */
const scopeToOrganization = (
  grant: TStoredMcpGrant,
  organizationId: string,
  workspaceOrganizationIds: Readonly<Record<string, string>>
): TStoredMcpGrant => {
  switch (grant.access) {
    case "all":
      return grant;
    case "organizations":
      return { ...grant, organizationIds: grant.organizationIds.filter((id) => id === organizationId) };
    case "workspaces":
      return {
        ...grant,
        workspaceIds: grant.workspaceIds.filter((id) => workspaceOrganizationIds[id] === organizationId),
      };
  }
};

/**
 * Writes the audit entries of prepared grant changes: one per organization each reaches (or one without
 * an organization, for a grant that reaches none), with the actor, the client and the whole grant before
 * and after. Both snapshots are recorded as they are, never diffed, so a narrowing that removes a
 * workspace or a permission is as visible as one that adds it. Call it once the change has committed.
 * Never throws: the change it records is already committed.
 */
export const queueMcpGrantAudits = async (
  actor: { userId: string; userType: TActor },
  records: ReadonlyArray<TMcpGrantAuditRecord>
): Promise<void> => {
  for (const { action, before, after, organizationIds, workspaceOrganizationIds } of records) {
    const grant = after ?? before;
    if (!grant) continue;
    // A grant that reaches no organization is filed once, without one, whole: its ids name nothing.
    const filings = organizationIds.length > 0 ? organizationIds : [UNKNOWN_DATA];
    for (const organizationId of filings) {
      const snapshot = (stored: TStoredMcpGrant | null) => {
        if (!stored) return null;
        if (organizationId === UNKNOWN_DATA) return getMcpGrantAuditSnapshot(stored);
        return getMcpGrantAuditSnapshot(
          scopeToOrganization(stored, organizationId, workspaceOrganizationIds)
        );
      };
      try {
        await queueAuditEventBackground({
          action,
          targetType: "mcpGrant",
          targetId: grant.id,
          userId: actor.userId,
          userType: actor.userType,
          organizationId,
          status: "success",
          oldObject: null,
          newObject: { before: snapshot(before), after: snapshot(after) },
        });
      } catch (error) {
        logger.error(
          { err: loggableError(error), grantId: grant.id, action },
          "Failed to queue MCP grant audit event"
        );
      }
    }
  }
};

/** Audits one grant change by the signed-in user who made it, once it has committed. Never throws. */
export const queueMcpGrantAudit = async ({
  action,
  actorUserId,
  before,
  after,
}: {
  action: TMcpGrantAuditAction;
  actorUserId: string;
  before: TStoredMcpGrant | null;
  after: TStoredMcpGrant | null;
}): Promise<void> => {
  try {
    const records = await prepareMcpGrantAudits(prisma, [{ action, before, after }]);
    await queueMcpGrantAudits({ userId: actorUserId, userType: "user" }, records);
  } catch (error) {
    logger.error(
      { err: loggableError(error), grantId: (after ?? before)?.id, action },
      "Failed to queue MCP grant audit event"
    );
  }
};

/** The system actor of a grant ended as a consequence of something else (a role lost, an account switched off). */
export const MCP_GRANT_SYSTEM_ACTOR = { userId: "system", userType: "system" } as const;

/**
 * How long a transaction that saves a grant may run: it resolves the chosen access, which lists the
 * workspaces the user can read in SpiceDB, and deletes what a narrowing takes away there, before it
 * commits. Above Prisma's 5-second default, which a SpiceDB retry alone can use up.
 */
export const MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS = 15_000;
