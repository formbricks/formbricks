import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { trimScopesForDashboardViewer } from "@/modules/auth/lib/dashboard-viewer-oauth-scopes";
import { readConsentedScopes } from "@/modules/auth/lib/oauth-grant-revocation";
import { readMcpGrantReadableWorkspaceIds } from "./access-options";
import { MAX_LISTED_AUTHORIZED_MCP_CLIENTS } from "./constants";
import {
  MCP_GRANT_ACCESS_SELECT,
  type TMcpGrantAccessRow,
  type TMcpGrantAccessSelection,
  type TMcpGrantPermissions,
  getMcpGrantPermissionsForScopes,
  isMcpGrantWithinCap,
  parseMcpGrantPermissions,
  readMcpGrantAccessSelection,
} from "./grant";
import { type TMcpGrantAccessOptions, limitMcpGrantAccessToOptions } from "./grant-access";
import {
  MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS,
  type TStoredMcpGrant,
  lockMcpGrant,
  narrowMcpGrantAccess,
  projectMcpGrants,
  writeMcpGrant,
} from "./grant-store";

/**
 * The MCP clients a user authorized, as Authorized apps shows and edits them (ENG-7152): each with its
 * grant. Reading and editing are always the session user's own: every query here is keyed on `userId`,
 * so another user's grant is indistinguishable from none.
 */

/** One MCP client the user authorized: when it was authorized and last changed, its grant and its cap. */
export type TAuthorizedMcpClient = {
  clientId: string;
  clientName: string | null;
  clientUri: string | null;
  connectedAt: Date;
  updatedAt: Date;
  /** `null` for a consent left without a grant, which `/api/mcp` refuses and the next refresh ends. */
  permissions: TMcpGrantPermissions | null;
  /**
   * The grant's organization & workspace access with what it selects (ENG-7153), `null` without a grant.
   * Only what the access picker still offers the user (spec story 36): an organization or workspace they
   * lost is not counted, nor opened in Edit.
   */
  access: TMcpGrantAccessSelection | null;
  /** What the client's scopes ask for: Edit can't give more (ADR-0041). */
  cap: TMcpGrantPermissions;
};

const capForScopes = (scopes: readonly string[], isDashboardViewer: boolean): TMcpGrantPermissions =>
  getMcpGrantPermissionsForScopes(isDashboardViewer ? trimScopesForDashboardViewer(scopes) : scopes);

const latest = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);

const CLIENT_SELECT = { select: { name: true, uri: true, scopes: true, skipConsent: true } } as const;

const LISTED_GRANT_SELECT = {
  clientId: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
  ...MCP_GRANT_ACCESS_SELECT,
} as const;

/**
 * The scopes that cap a client's grant: the consented ones, or, for a `skipConsent` client, which the
 * provider authorizes without a consent, the scopes it is registered with.
 */
const capScopes = (
  client: { scopes: string[]; skipConsent: boolean | null },
  consentedScopes: string[]
): string[] => (client.skipConsent ? client.scopes : consentedScopes);

/**
 * The MCP clients the user authorized, most recently changed first: one per client with a consent, and one
 * per other grant the user holds (spec stories 29 and 38), so Revoke reaches every grant. That is a
 * `skipConsent` client, which never has a consent, capped by its registered scopes; or a client left with a
 * grant and no consent (switched off `skipConsent` after it was authorized), capped at nothing until the
 * user approves it again. Three reads whatever the count: the consents with their clients, then, side by
 * side, the grants of those clients and the user's other grants. Duplicate consent rows of one client
 * fold into one entry.
 */
export const listAuthorizedMcpClients = async (
  userId: string,
  { isDashboardViewer, accessOptions }: { isDashboardViewer: boolean; accessOptions: TMcpGrantAccessOptions }
): Promise<TAuthorizedMcpClient[]> => {
  const consents = await prisma.oauthConsent.findMany({
    where: { userId },
    select: {
      id: true,
      clientId: true,
      scopes: true,
      createdAt: true,
      updatedAt: true,
      client: CLIENT_SELECT,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: MAX_LISTED_AUTHORIZED_MCP_CLIENTS,
  });
  const consentedClientIds = [...new Set(consents.map(({ clientId }) => clientId))];
  const [consentedGrants, unconsentedGrants] = await Promise.all([
    consentedClientIds.length === 0
      ? []
      : prisma.mcpGrant.findMany({
          where: { userId, clientId: { in: consentedClientIds } },
          select: LISTED_GRANT_SELECT,
        }),
    prisma.mcpGrant.findMany({
      where: { userId, clientId: { notIn: consentedClientIds } },
      select: { ...LISTED_GRANT_SELECT, client: CLIENT_SELECT },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: MAX_LISTED_AUTHORIZED_MCP_CLIENTS,
    }),
  ]);
  const grantByClient = new Map(consentedGrants.map((grant) => [grant.clientId, grant]));
  const accessOf = (grant: TMcpGrantAccessRow) =>
    limitMcpGrantAccessToOptions(readMcpGrantAccessSelection(grant), accessOptions);

  const clients = new Map<string, TAuthorizedMcpClient>();
  for (const consent of consents) {
    const existing = clients.get(consent.clientId);
    if (existing) {
      // Rows come newest first, so the first one seen holds the consent's current scopes.
      if (consent.createdAt < existing.connectedAt) existing.connectedAt = consent.createdAt;
      continue;
    }
    const grant = grantByClient.get(consent.clientId);
    clients.set(consent.clientId, {
      clientId: consent.clientId,
      clientName: consent.client.name,
      clientUri: consent.client.uri,
      connectedAt: consent.createdAt,
      updatedAt: grant ? latest(consent.updatedAt, grant.updatedAt) : consent.updatedAt,
      permissions: grant ? parseMcpGrantPermissions(grant.permissions) : null,
      access: grant ? accessOf(grant) : null,
      cap: capForScopes(capScopes(consent.client, consent.scopes), isDashboardViewer),
    });
  }
  for (const grant of unconsentedGrants) {
    clients.set(grant.clientId, {
      clientId: grant.clientId,
      clientName: grant.client.name,
      clientUri: grant.client.uri,
      connectedAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      permissions: parseMcpGrantPermissions(grant.permissions),
      access: accessOf(grant),
      cap: capForScopes(capScopes(grant.client, []), isDashboardViewer),
    });
  }
  return [...clients.values()]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, MAX_LISTED_AUTHORIZED_MCP_CLIENTS);
};

export type TEditMcpGrantResult =
  | { status: "not_found" }
  | { status: "beyond_scopes" }
  | { status: "selection_unavailable"; field: "organizationIds" | "workspaceIds" }
  | { status: "saved"; before: TStoredMcpGrant; after: TStoredMcpGrant };

/**
 * The scopes that cap the user's grant to the client, read in the caller's transaction, or `null` when
 * the client has neither a consent nor `skipConsent`. A consent is read `FOR SHARE`, so a revoke in flight
 * is waited on rather than read around.
 */
const readCapScopes = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<string[] | null> => {
  const client = await tx.oauthClient.findUnique({
    where: { clientId },
    select: { scopes: true, skipConsent: true },
  });
  if (!client) return null;
  if (client.skipConsent) return client.scopes;
  return readConsentedScopes(tx, userId, clientId);
};

/**
 * Sets the user's grant to `clientId` (Authorized apps' Edit): its permissions and, when given, its
 * organization & workspace access. Refused when the user has no grant (or no consent, for a client that
 * needs one), when `permissions` go above what the client's scopes ask for (and, for a Dashboard viewer,
 * what a viewer may give), and when `access` adds an organization or workspace the user can't select;
 * one the grant already selected and the user has lost is dropped instead (`resolveMcpGrantSelection`).
 *
 * The workspaces SpiceDB lets the user select are looked up before the transaction, so no lookup runs
 * under a row lock; the transaction re-checks the user's memberships from PostgreSQL. In it, the grant row
 * is locked first, then the consent read `FOR SHARE`; what a narrowing takes away is deleted from SpiceDB
 * before the transaction commits, or the edit fails. `/api/mcp` reads the grant on every call and what the
 * access adds is written to SpiceDB once the transaction commits, so the change applies from the client's
 * next call.
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
  let grantId: string | null = null;
  try {
    const readableWorkspaceIds = await readMcpGrantReadableWorkspaceIds(userId, access);
    const result = await prisma.$transaction(
      async (tx): Promise<TEditMcpGrantResult> => {
        const before = await lockMcpGrant(tx, { userId, clientId });
        if (!before) return { status: "not_found" };
        grantId = before.id;
        const scopes = await readCapScopes(tx, userId, clientId);
        if (!scopes) return { status: "not_found" };
        if (!isMcpGrantWithinCap(permissions, capForScopes(scopes, isDashboardViewer))) {
          return { status: "beyond_scopes" };
        }
        let saved = access;
        if (access) {
          const resolved = await narrowMcpGrantAccess(tx, { userId, before, access, readableWorkspaceIds });
          if (resolved.status === "unavailable")
            return { status: "selection_unavailable", field: resolved.field };
          saved = resolved.access;
        }
        const written = await writeMcpGrant(tx, { userId, clientId, before, permissions, access: saved });
        return { status: "saved", before, after: written.after };
      },
      { timeout: MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS }
    );
    if (result.status === "saved") await projectMcpGrants([result.after.id]);
    return result;
  } catch (error) {
    // A narrowing may have deleted relationships in SpiceDB before the transaction failed: reconcile the
    // grant from its committed rows, so it doesn't stay narrower than they say.
    if (grantId) await projectMcpGrants([grantId]);
    throw error;
  }
};
