import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import type { TAuthorizationActor } from "./contract";
import { getApiKeyAuthById } from "./resolvers";

export type TBridgeWorkspacePermission = "read" | "write" | "manage";

const TEAM_PERMISSIONS = {
  read: ["read", "readWrite", "manage"],
  write: ["readWrite", "manage"],
  manage: ["manage"],
} as const satisfies Record<TBridgeWorkspacePermission, readonly string[]>;

const KEY_PERMISSIONS = {
  read: ["read", "write", "manage"],
  write: ["write", "manage"],
  manage: ["manage"],
} as const satisfies Record<TBridgeWorkspacePermission, readonly string[]>;

export const bridgeKeyHasOrganizationAccess = (
  auth: TAuthenticationApiKey,
  permission: "read" | "write"
): boolean => {
  const access = auth.organizationAccess?.accessControl;
  return access?.write === true || (permission === "read" && access?.read === true);
};

export const bridgeKeyWorkspaceIds = (
  auth: TAuthenticationApiKey,
  permission: TBridgeWorkspacePermission
): ReadonlyArray<string> =>
  auth.workspacePermissions
    .filter((grant) => (KEY_PERMISSIONS[permission] as readonly string[]).includes(grant.permission))
    .map((grant) => grant.workspaceId);

/**
 * Temporary bridge only. One set-based query for both scalar and list decisions, independent of
 * list size. Correlating the team and workspace organizations prevents malformed cross-tenant
 * grants from granting access. Billing membership and inactive users never inherit team access.
 * Values are bound parameters; database errors propagate without logging query data.
 */
export const findBridgeUserWorkspaceIds = reactCache(
  async (
    userId: string,
    permission: TBridgeWorkspacePermission,
    organizationId?: string,
    workspaceId?: string
  ): Promise<ReadonlyArray<string>> => {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT w.id
      FROM "Workspace" w
      JOIN "Membership" m ON m."organizationId" = w."organizationId"
      JOIN "User" u ON u.id = m."userId"
      WHERE u.id = ${userId} AND u."isActive" = true
        ${organizationId === undefined ? Prisma.empty : Prisma.sql`AND w."organizationId" = ${organizationId}`}
        ${workspaceId === undefined ? Prisma.empty : Prisma.sql`AND w.id = ${workspaceId}`}
        AND (
          m.role IN ('owner', 'manager')
          OR (m.role = 'member' AND EXISTS (
            SELECT 1 FROM "WorkspaceTeam" wt
            JOIN "Team" t ON t.id = wt."teamId" AND t."organizationId" = w."organizationId"
            JOIN "TeamUser" tu ON tu."teamId" = t.id
            WHERE wt."workspaceId" = w.id AND tu."userId" = u.id
              AND wt.permission IN (${Prisma.join(TEAM_PERMISSIONS[permission])})
          ))
        )
      ORDER BY w.id
    `);
    return rows.map(({ id }) => id);
  }
);

export const lookupBridgeResourceIds = async (
  actor: TAuthorizationActor,
  resourceType: "organization" | "workspace",
  permission: "read" | "write"
): Promise<ReadonlyArray<string>> => {
  if (actor.type === "user") {
    if (resourceType === "workspace") return findBridgeUserWorkspaceIds(actor.id, permission);

    const organizations = await prisma.organization.findMany({
      where: {
        memberships: {
          some: {
            userId: actor.id,
            user: { isActive: true },
            ...(permission === "write" ? { role: "owner" as const } : {}),
          },
        },
      },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return organizations.map(({ id }) => id);
  }

  if (actor.type !== "apiKey") throw new Error("Unsupported authorization actor");
  // The rc.5 resolver excludes workspace grants outside the key's owning organization.
  const auth = await getApiKeyAuthById(actor.id);
  if (!auth) return [];
  if (resourceType === "organization") {
    return permission === "read" && bridgeKeyHasOrganizationAccess(auth, "read") ? [auth.organizationId] : [];
  }
  return [...new Set(bridgeKeyWorkspaceIds(auth, permission))].sort();
};
