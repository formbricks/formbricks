import "server-only";
import { prisma } from "@formbricks/database";
import { trimScopesForDashboardViewer } from "@/modules/auth/lib/dashboard-viewer-oauth-scopes";
import { readConsentedScopes } from "@/modules/auth/lib/oauth-grant-revocation";
import { MAX_LISTED_MCP_CONNECTIONS } from "./constants";
import {
  type TMcpGrantAccess,
  type TMcpGrantAccessSelection,
  type TMcpGrantPermissions,
  getMcpGrantPermissionsForScopes,
  isMcpGrantWithinCap,
  parseMcpGrantPermissions,
} from "./grant";
import { type TStoredMcpGrant, hasMcpGrant, projectMcpGrants, saveMcpGrant } from "./grant-store";

/**
 * A user's MCP connections as Authorized apps shows and edits them (ENG-7152): one per MCP client the user
 * has consented to, with its grant. Reading and editing are always the session user's own: every query
 * here is keyed on `userId`, so another user's connection is indistinguishable from none.
 */

/** One connection: the client, when it was connected and last changed, its grant and what caps it. */
export type TMcpConnection = {
  clientId: string;
  clientName: string | null;
  clientUri: string | null;
  /** The consent Revoke deletes the connection through (the newest, when duplicates exist). */
  consentId: string;
  connectedAt: Date;
  updatedAt: Date;
  /** `null` for a consent left without a grant, which `/api/mcp` refuses and the next refresh ends. */
  permissions: TMcpGrantPermissions | null;
  /** The grant's organization & workspace access (ENG-7153), `null` without a grant. */
  access: TMcpGrantAccess | null;
  /** What it selects: organizations for Only selected organizations, workspaces for Only selected workspaces. */
  organizationIds: string[];
  workspaceIds: string[];
  /** What the client's consented scopes ask for: Edit can't give more (ADR-0041). */
  cap: TMcpGrantPermissions;
};

const capForScopes = (scopes: readonly string[], isDashboardViewer: boolean): TMcpGrantPermissions =>
  getMcpGrantPermissionsForScopes(isDashboardViewer ? trimScopesForDashboardViewer(scopes) : scopes);

const latest = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);

/**
 * The user's connections, most recently changed first. Two queries whatever the count: the consents with
 * their clients, then the grants. Duplicate consent rows of one client fold into one connection.
 */
export const listMcpConnections = async (
  userId: string,
  { isDashboardViewer }: { isDashboardViewer: boolean }
): Promise<TMcpConnection[]> => {
  const [consents, grants] = await Promise.all([
    prisma.oauthConsent.findMany({
      where: { userId },
      select: {
        id: true,
        clientId: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { name: true, uri: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: MAX_LISTED_MCP_CONNECTIONS,
    }),
    prisma.mcpGrant.findMany({
      where: { userId },
      select: {
        clientId: true,
        permissions: true,
        updatedAt: true,
        access: true,
        organizations: { select: { organizationId: true }, orderBy: { organizationId: "asc" } },
        workspaces: { select: { workspaceId: true }, orderBy: { workspaceId: "asc" } },
      },
      take: MAX_LISTED_MCP_CONNECTIONS,
    }),
  ]);
  const grantByClient = new Map(grants.map((grant) => [grant.clientId, grant]));

  const connections = new Map<string, TMcpConnection>();
  for (const consent of consents) {
    const existing = connections.get(consent.clientId);
    if (existing) {
      // Rows come newest first, so the first one seen holds the consent's current scopes.
      if (consent.createdAt < existing.connectedAt) existing.connectedAt = consent.createdAt;
      continue;
    }
    const grant = grantByClient.get(consent.clientId);
    connections.set(consent.clientId, {
      clientId: consent.clientId,
      clientName: consent.client.name,
      clientUri: consent.client.uri,
      consentId: consent.id,
      connectedAt: consent.createdAt,
      updatedAt: grant ? latest(consent.updatedAt, grant.updatedAt) : consent.updatedAt,
      permissions: grant ? parseMcpGrantPermissions(grant.permissions) : null,
      access: grant?.access ?? null,
      // Only the selection the mode reads, as `can()` does (ADR-0042).
      organizationIds:
        grant?.access === "organizations"
          ? grant.organizations.map(({ organizationId }) => organizationId)
          : [],
      workspaceIds:
        grant?.access === "workspaces" ? grant.workspaces.map(({ workspaceId }) => workspaceId) : [],
      cap: capForScopes(consent.scopes, isDashboardViewer),
    });
  }
  return [...connections.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

export type TEditMcpGrantResult =
  | { status: "not_found" }
  | { status: "beyond_scopes" }
  | { status: "saved"; before: TStoredMcpGrant; after: TStoredMcpGrant };

/**
 * Sets the permissions of the user's grant to `clientId` (Authorized apps' Edit). Refused when the user
 * has no consent and grant for the client, and when `permissions` go above what the consented scopes ask
 * for (and, for a Dashboard viewer, what a viewer may give). The consent rows are read `FOR SHARE`, so a
 * revoke in flight is waited on and the edit then finds nothing, rather than writing a grant back after
 * it. `/api/mcp` reads the grant on every call and the access is written to SpiceDB once the transaction
 * commits, so the change applies from the client's next call.
 */
export const editMcpGrant = async ({
  userId,
  clientId,
  permissions,
  access,
  isDashboardViewer,
}: {
  userId: string;
  clientId: string;
  permissions: TMcpGrantPermissions;
  /** The organization & workspace access to set; omitted keeps the grant's (ENG-7153). */
  access?: TMcpGrantAccessSelection;
  isDashboardViewer: boolean;
}): Promise<TEditMcpGrantResult> => {
  const result = await prisma.$transaction(async (tx): Promise<TEditMcpGrantResult> => {
    const scopes = await readConsentedScopes(tx, userId, clientId);
    if (!scopes || !(await hasMcpGrant(tx, { userId, clientId }))) return { status: "not_found" };
    if (!isMcpGrantWithinCap(permissions, capForScopes(scopes, isDashboardViewer))) {
      return { status: "beyond_scopes" };
    }
    const { before, after } = await saveMcpGrant(tx, { userId, clientId, permissions, access });
    // A grant is only deleted with its consent rows, which this transaction holds `FOR SHARE`.
    if (!before) throw new Error("MCP grant disappeared while its consent was locked");
    return { status: "saved", before, after };
  });
  if (result.status === "saved") await projectMcpGrants([result.after.id]);
  return result;
};
