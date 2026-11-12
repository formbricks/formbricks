import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import {
  type TMcpGrant,
  type TMcpGrantAccess,
  type TMcpGrantPermissions,
  parseMcpGrantPermissions,
} from "./grant";

/**
 * Where grants live (ADR-0041): one `McpGrant` row per MCP connection (user + client). Saving and
 * deleting take the caller's transaction, so a grant is written and removed together with the consent
 * it belongs to.
 *
 * Organization & workspace selections (`McpGrantOrganization`, `McpGrantWorkspace`) are ENG-7153's; a
 * grant saved here has All access and no selection.
 */

/** A grant as stored, with what an audit entry names it by. */
export type TStoredMcpGrant = TMcpGrant & { id: string; userId: string; clientId: string };

const GRANT_SELECT = {
  id: true,
  userId: true,
  clientId: true,
  access: true,
  permissions: true,
} as const;

/** A row as `GRANT_SELECT` reads it. */
type TGrantRow = {
  id: string;
  userId: string;
  clientId: string;
  access: TMcpGrantAccess;
  permissions: unknown;
};

const toStoredGrant = (row: TGrantRow): TStoredMcpGrant => ({
  id: row.id,
  userId: row.userId,
  clientId: row.clientId,
  access: row.access,
  permissions: parseMcpGrantPermissions(row.permissions),
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
 * Sets the connection's grant to `permissions` with All access, creating it when the connection has none.
 * Returns the grant before (`null` when created) and after, for the audit entry.
 */
export const saveMcpGrant = async (
  tx: Prisma.TransactionClient,
  { userId, clientId, permissions }: { userId: string; clientId: string; permissions: TMcpGrantPermissions }
): Promise<{ before: TStoredMcpGrant | null; after: TStoredMcpGrant }> => {
  const existing = await tx.mcpGrant.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: GRANT_SELECT,
  });
  const row = await tx.mcpGrant.upsert({
    where: { userId_clientId: { userId, clientId } },
    create: { userId, clientId, access: "all", permissions },
    update: { access: "all", permissions },
    select: GRANT_SELECT,
  });
  return { before: existing ? toStoredGrant(existing) : null, after: toStoredGrant(row) };
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
  return rows.map(toStoredGrant);
};

/** What an audit entry records of a grant: the client and the grant itself, not its row ids. */
export const getMcpGrantAuditSnapshot = (grant: TStoredMcpGrant) => ({
  clientId: grant.clientId,
  access: grant.access,
  permissions: grant.permissions,
});

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
