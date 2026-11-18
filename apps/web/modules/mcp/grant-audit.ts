import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { type TActor, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { getMcpGrantSelectedIds } from "./grant-access";
import { type TStoredMcpGrant, getMcpGrantAccessSelection } from "./grant-store";
import { MCP_PERMISSIONS, type TMcpPermission } from "./permissions";

/**
 * Audit entries for MCP grant changes (ADR-0041): each change filed under every organization the grant
 * reaches before or after it, prepared in the caller's transaction and queued once it has committed.
 * Grants themselves are read and written in `grant-store.ts`.
 */

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

/** What Revoke ended for a client, as `revokeMcpClient` counts it. */
export type TMcpClientRevocation = {
  consentsDeleted: number;
  refreshTokensRevoked: number;
  accessTokensRevoked: number;
};

/**
 * Audits a Revoke that ended a client's consent and tokens but no grant: a consent left without one (the
 * previous release wrote it during a rolling upgrade). Its grant entries would be none, so the client is
 * the target and what was ended the record. Filed like a grant with All access, which is what such a
 * consent gave: one entry per organization the user belongs to, or one without an organization. Call it
 * once the revocation has committed. Never throws.
 */
export const queueMcpClientRevocationAudit = async ({
  actorUserId,
  clientId,
  ended,
}: {
  actorUserId: string;
  clientId: string;
  ended: TMcpClientRevocation;
}): Promise<void> => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: actorUserId },
      select: { organizationId: true },
    });
    const filings = memberships.length > 0 ? memberships.map((m) => m.organizationId) : [UNKNOWN_DATA];
    for (const organizationId of filings) {
      // Per organization, as `queueMcpGrantAudits` does: one failure doesn't drop the others' entries.
      try {
        await queueAuditEventBackground({
          action: "deleted",
          targetType: "mcpGrant",
          targetId: clientId,
          userId: actorUserId,
          userType: "user",
          organizationId,
          status: "success",
          oldObject: { clientId, grant: null, ended },
          newObject: null,
        });
      } catch (error) {
        logger.error(
          { err: loggableError(error), clientId },
          "Failed to queue MCP client revocation audit event"
        );
      }
    }
  } catch (error) {
    logger.error(
      { err: loggableError(error), clientId },
      "Failed to read the memberships for an MCP client revocation audit"
    );
  }
};

/** The actor of a grant ended by no user: an account switched off by the retention sweep, or recovered by SSO. */
export const MCP_GRANT_SYSTEM_ACTOR = { userId: "system", userType: "system" } as const;
