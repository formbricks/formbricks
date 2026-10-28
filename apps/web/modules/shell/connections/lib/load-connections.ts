import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getWorkspacesByOrganizationId } from "@/modules/organization/settings/api-keys/lib/workspaces";
import { type TConnectionRow, buildConnectionRows } from "./connection-rows";

// Both lists are bounded: a person rarely holds more than a handful of OAuth approvals, and an
// organization more than a few dozen keys. A cap keeps the page cheap for the outlier instead of
// pulling the whole table.
const MAX_CONNECTIONS_PER_KIND = 200;

/**
 * Whether the person may see and manage the organization's API keys. Owners and managers only; everyone
 * else still sees (and can revoke) their own OAuth connections.
 */
export const canManageApiKeys = reactCache(
  async (userId: string, organizationId: string): Promise<boolean> =>
    withAuthorizationSurface("page", () =>
      can({ type: "user", id: userId }, "organization.manage_api_keys", {
        type: "organization",
        id: organizationId,
      })
    )
);

/**
 * The merged Agent connections list for one organization and one signed-in person.
 *
 * API keys are owned by the organization (`ApiKey.organizationId`); OAuth consents are owned by the
 * person (`oauthConsent.userId`), so only the caller's own are read. The consent query joins the client in
 * the same round trip rather than asking Better Auth for each client in turn, so the page costs three
 * queries however many apps the person has connected.
 */
export const loadAgentConnections = reactCache(
  async (organizationId: string, userId: string): Promise<TConnectionRow[]> => {
    const mayManageApiKeys = await canManageApiKeys(userId, organizationId);

    const [consents, apiKeys, workspaces] = await Promise.all([
      prisma.oauthConsent.findMany({
        where: { userId },
        select: {
          id: true,
          scopes: true,
          createdAt: true,
          client: { select: { clientId: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_CONNECTIONS_PER_KIND,
      }),
      mayManageApiKeys
        ? prisma.apiKey.findMany({
            where: { organizationId },
            select: {
              id: true,
              label: true,
              createdAt: true,
              lastUsedAt: true,
              organizationAccess: true,
              apiKeyWorkspaces: { select: { workspaceId: true, permission: true } },
            },
            orderBy: { createdAt: "desc" },
            take: MAX_CONNECTIONS_PER_KIND,
          })
        : [],
      mayManageApiKeys ? getWorkspacesByOrganizationId(organizationId) : [],
    ]);

    return buildConnectionRows({ consents, apiKeys, workspaces });
  }
);

/** How many connections exist, for the "nothing connected yet" state. Two counts, no rows. */
export const countAgentConnections = async (organizationId: string, userId: string): Promise<number> => {
  const mayManageApiKeys = await canManageApiKeys(userId, organizationId);

  const [consents, apiKeys] = await Promise.all([
    prisma.oauthConsent.count({ where: { userId } }),
    mayManageApiKeys ? prisma.apiKey.count({ where: { organizationId } }) : 0,
  ]);

  return consents + apiKeys;
};
