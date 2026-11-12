import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  type TMcpGrantReach,
  deleteMcpGrantRelationshipsBeforeCommit,
  reconcileMcpGrantRelationships,
} from "@/lib/authzed/mcp-grant";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import {
  type TMcpGrantAccess,
  type TMcpGrantAccessSelection,
  type TMcpGrantPermissions,
  parseMcpGrantPermissions,
} from "./grant";
import { getMcpGrantSelectedIds } from "./grant-access";

/**
 * Where grants live (ADR-0041): one `McpGrant` row per MCP connection (user + client). Saving and
 * deleting take the caller's transaction, so a grant is written and removed together with the consent
 * it belongs to.
 *
 * The organization & workspace selections (`McpGrantOrganization`, `McpGrantWorkspace`) are written in the
 * same transaction. Their triggers queue the grant for the SpiceDB projection (`lib/authzed/mcp-grant.ts`,
 * ADR-0042), so the relationships follow the rows through the outbox, and a cascade from a deleted
 * workspace, organization or grant drops them too. The synchronous write is ordered so the safe direction
 * wins: what a save or a delete takes away leaves SpiceDB inside the transaction, before it commits, and
 * a failure fails the change; what a save adds is written once it has committed ({@link projectMcpGrants}),
 * best-effort, with the outbox event as the repair. Either way the change applies on the client's next
 * call rather than when the outbox delivers.
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
  access: true,
  permissions: true,
  organizations: { select: { organizationId: true }, orderBy: { organizationId: "asc" } },
  workspaces: { select: { workspaceId: true }, orderBy: { workspaceId: "asc" } },
} as const;

/** A row as `GRANT_SELECT` reads it. */
type TGrantRow = {
  id: string;
  userId: string;
  clientId: string;
  access: TMcpGrantAccess;
  permissions: unknown;
  organizations: { organizationId: string }[];
  workspaces: { workspaceId: string }[];
};

/**
 * A grant row's organization & workspace access. Only the selection its mode reads: a stray row of the
 * other kind reaches nothing (ADR-0042), so it is not shown or audited either.
 */
export const readMcpGrantAccess = (
  row: Pick<TGrantRow, "access" | "organizations" | "workspaces">
): TMcpGrantAccessSelection => {
  switch (row.access) {
    case "all":
      return { access: "all" };
    case "organizations":
      return {
        access: "organizations",
        organizationIds: row.organizations.map(({ organizationId }) => organizationId),
      };
    case "workspaces":
      return { access: "workspaces", workspaceIds: row.workspaces.map(({ workspaceId }) => workspaceId) };
  }
};

const withAccess = (
  grant: Pick<TStoredMcpGrant, "id" | "userId" | "clientId" | "permissions">,
  access: TMcpGrantAccessSelection
): TStoredMcpGrant => ({
  id: grant.id,
  userId: grant.userId,
  clientId: grant.clientId,
  permissions: grant.permissions,
  ...access,
});

const toStoredGrant = (row: TGrantRow, access: TMcpGrantAccessSelection = readMcpGrantAccess(row)) =>
  withAccess({ ...row, permissions: parseMcpGrantPermissions(row.permissions) }, access);

/** What a stored grant's SpiceDB relationships follow from. */
const toReach = (grant: TStoredMcpGrant): TMcpGrantReach => ({
  id: grant.id,
  access: grant.access,
  ...getMcpGrantSelectedIds(grant),
});

/** The connection's grant, or `null` when it has none. */
export const getMcpGrant = async (userId: string, clientId: string): Promise<TStoredMcpGrant | null> => {
  const row = await prisma.mcpGrant.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: GRANT_SELECT,
  });
  return row ? toStoredGrant(row) : null;
};

/** Whether the connection has a grant, read in the caller's transaction. */
export const hasMcpGrant = async (
  tx: Prisma.TransactionClient,
  { userId, clientId }: { userId: string; clientId: string }
): Promise<boolean> =>
  (await tx.mcpGrant.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { id: true },
  })) !== null;

/**
 * The part of `selection` the user may pick: organizations they belong to, and workspaces of those
 * organizations. Anything else is dropped rather than stored. It would reach nothing anyway (`can()`
 * checks the user too), but a stored id must name something the user could have seen in the picker.
 */
const ownSelection = async (
  tx: Prisma.TransactionClient,
  userId: string,
  selection: TMcpGrantAccessSelection
): Promise<TMcpGrantAccessSelection> => {
  switch (selection.access) {
    case "all":
      return selection;
    case "organizations": {
      const memberships = await tx.membership.findMany({
        where: { userId, organizationId: { in: selection.organizationIds } },
        select: { organizationId: true },
        orderBy: { organizationId: "asc" },
      });
      return {
        access: "organizations",
        organizationIds: memberships.map(({ organizationId }) => organizationId),
      };
    }
    case "workspaces": {
      const workspaces = await tx.workspace.findMany({
        where: { id: { in: selection.workspaceIds }, organization: { memberships: { some: { userId } } } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      return { access: "workspaces", workspaceIds: workspaces.map(({ id }) => id) };
    }
  }
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
 * Sets the connection's grant: `permissions`, and the organization & workspace access `access` names.
 * Without `access` an existing grant keeps the access it has and a new one gets All access, so a request
 * that says nothing about it never widens it. Returns the grant before (`null` when created) and after,
 * for the audit entry.
 */
export const saveMcpGrant = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    permissions,
    access,
  }: {
    userId: string;
    clientId: string;
    permissions: TMcpGrantPermissions;
    access?: TMcpGrantAccessSelection;
  }
): Promise<{ before: TStoredMcpGrant | null; after: TStoredMcpGrant }> => {
  const existing = await tx.mcpGrant.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: GRANT_SELECT,
  });
  const mode = access?.access ?? existing?.access ?? "all";
  const row = await tx.mcpGrant.upsert({
    where: { userId_clientId: { userId, clientId } },
    create: { userId, clientId, access: mode, permissions },
    // `access` only when it changes: the column's trigger queues a projection, and a no-op does not.
    update: { permissions, ...(existing?.access === mode ? {} : { access: mode }) },
    select: GRANT_SELECT,
  });
  const before = existing ? toStoredGrant(existing) : null;
  if (!access) return { before, after: toStoredGrant(row) };

  const selected = await ownSelection(tx, userId, access);
  await replaceSelection(tx, row.id, selected);
  const after = toStoredGrant(row, selected);
  // What the grant no longer reaches leaves SpiceDB before this commits, or the save fails (ENG-7153).
  if (before)
    await deleteMcpGrantRelationshipsBeforeCommit([{ before: toReach(before), after: toReach(after) }]);
  return { before, after };
};

/**
 * Deletes the user's grants: the one for `clientId`, or every one the user holds when it is omitted.
 * Returns what was deleted, for the audit entries.
 */
export const deleteMcpGrants = async (
  tx: Prisma.TransactionClient,
  { userId, clientId }: { userId: string; clientId?: string }
): Promise<TStoredMcpGrant[]> => {
  const where = { userId, ...(clientId ? { clientId } : {}) };
  const rows = await tx.mcpGrant.findMany({ where, select: GRANT_SELECT, orderBy: { id: "asc" } });
  if (rows.length === 0) return [];
  await tx.mcpGrant.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  const grants = rows.map((row) => toStoredGrant(row));
  // A revoked grant's reach leaves SpiceDB before the delete commits, or the revoke fails (ENG-7153).
  await deleteMcpGrantRelationshipsBeforeCommit(
    grants.map((grant) => ({ before: toReach(grant), after: null }))
  );
  return grants;
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
 * What an audit entry records of a grant: the client and the grant itself (its access with what that
 * selects, and its permissions), not its row ids.
 */
export const getMcpGrantAuditSnapshot = (grant: TStoredMcpGrant) => {
  const { id: _id, userId: _userId, clientId, permissions, ...access } = grant;
  return { clientId, ...access, permissions };
};

/**
 * Writes the audit entry for a grant that was created, changed or deleted: the acting user, the client
 * and the grant before and after. A grant belongs to a user, not an organization, so the entry carries
 * no organization. Never throws: the change it records is already committed.
 */
export const queueMcpGrantAudit = async ({
  action,
  actorUserId,
  before,
  after,
}: {
  action: "created" | "updated" | "deleted";
  actorUserId: string;
  before: TStoredMcpGrant | null;
  after: TStoredMcpGrant | null;
}): Promise<void> => {
  const grant = after ?? before;
  if (!grant) return;
  try {
    await queueAuditEventBackground({
      action,
      targetType: "mcpGrant",
      targetId: grant.id,
      userId: actorUserId,
      userType: "user",
      organizationId: UNKNOWN_DATA,
      status: "success",
      oldObject: before ? getMcpGrantAuditSnapshot(before) : null,
      newObject: after ? getMcpGrantAuditSnapshot(after) : null,
    });
  } catch (error) {
    logger.error({ error, grantId: grant.id, action }, "Failed to queue MCP grant audit event");
  }
};
