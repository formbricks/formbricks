import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { trimScopesForDashboardViewer } from "@/modules/auth/lib/dashboard-viewer-oauth-scopes";
import { consentBound, readConsentedScopes } from "@/modules/auth/lib/oauth-consent-rows";
import { readMcpGrantReadableWorkspaceIds } from "./access-options";
import { MAX_LISTED_AUTHORIZED_MCP_CLIENTS } from "./constants";
import {
  MCP_GRANT_ACCESS_SELECT,
  type TMcpGrantAccessRow,
  type TMcpGrantAccessSelection,
  type TMcpGrantPermissions,
  type TRequestedMcpGrant,
  getMcpGrantPermissionsForScopes,
  isMcpGrantWithinCap,
  parseMcpGrantPermissions,
  readMcpGrantAccessSelection,
} from "./grant";
import { type TMcpGrantAccessOptions, limitMcpGrantAccessToOptions } from "./grant-access";
import { type TMcpGrantAuditRecord, prepareMcpGrantAudits } from "./grant-audit";
import {
  MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS,
  type TStoredMcpGrant,
  lockMcpGrant,
  narrowMcpGrantAccess,
  projectMcpGrants,
  repairMcpGrantsAfterFailedSave,
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
  /**
   * When the grant was last saved, `null` without one: the version Edit opened, sent back with its save so
   * a save over a change made elsewhere is refused instead of undoing it.
   */
  grantUpdatedAt: Date | null;
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

type TConsentScopes = { scopes: string[]; updatedAt: Date };

/** Groups rows by their client, keeping their order: one pass, each row appended in place. */
const groupByClient = <TRow extends { clientId: string }>(rows: ReadonlyArray<TRow>): Map<string, TRow[]> => {
  const byClient = new Map<string, TRow[]>();
  for (const row of rows) {
    const group = byClient.get(row.clientId);
    if (group) group.push(row);
    else byClient.set(row.clientId, [row]);
  }
  return byClient;
};

/** The scopes a client's consent rows allow, by the rule a save holds a grant to ({@link consentBound}). */
const consentedScopesOf = (rows: ReadonlyArray<TConsentScopes>): string[] => consentBound(rows)?.scopes ?? [];

/**
 * Each client's consent rows tied at its newest `updatedAt`: every row {@link consentBound} decides on, so
 * duplicate rows written in the same second are intersected here as a save intersects them. Bounded by
 * the clients asked for; a client's tied rows are the few concurrent first approvals can insert.
 */
const readNewestConsents = async (
  userId: string,
  clientIds: ReadonlyArray<string>
): Promise<ReadonlyMap<string, TConsentScopes[]>> => {
  const rows = await prisma.$queryRaw<({ clientId: string } & TConsentScopes)[]>`
    SELECT c."clientId", c."scopes", c."updatedAt"
    FROM "oauthConsent" c
    WHERE c."userId" = ${userId} AND c."clientId" IN (${Prisma.join([...clientIds])})
      AND c."updatedAt" = (
        SELECT max(n."updatedAt") FROM "oauthConsent" n
        WHERE n."userId" = c."userId" AND n."clientId" = c."clientId"
      )`;
  return groupByClient(rows);
};

/**
 * The clients whose consent rows the capped read may have cut short, read in full ({@link
 * readNewestConsents}); none below the cap. Past it, the clients with a listed row stamped as the last
 * listed one, whose rows tied with it can lie beyond the cap (rows are listed newest first, so a client's
 * rows stamped later are all listed), and the clients of grants read as unconsented, whose consent the
 * capped read left out: their cap comes from that consent, not from none. The read is bounded by those
 * clients, never by every consent the user gave.
 */
const readCutConsents = async (
  userId: string,
  listed: ReadonlyArray<{ clientId: string; updatedAt: Date }>,
  unconsentedGrants: ReadonlyArray<{ clientId: string }>
): Promise<ReadonlyMap<string, TConsentScopes[]>> => {
  const last = listed.at(-1);
  if (listed.length < MAX_LISTED_AUTHORIZED_MCP_CLIENTS || !last) return new Map();
  const atBoundary = listed
    .filter(({ updatedAt }) => updatedAt.getTime() === last.updatedAt.getTime())
    .map(({ clientId }) => clientId);
  return readNewestConsents(userId, [
    ...new Set([...atBoundary, ...unconsentedGrants.map(({ clientId }) => clientId)]),
  ]);
};

/**
 * An entry's grant fields: its permissions, access and version, `null` without a grant, and when it last
 * changed, the later of the consent's change and the grant's.
 */
const grantFields = (
  grant: (TMcpGrantAccessRow & { permissions: unknown; updatedAt: Date }) | undefined,
  consentUpdatedAt: Date,
  accessOf: (grant: TMcpGrantAccessRow) => TMcpGrantAccessSelection
): Pick<TAuthorizedMcpClient, "permissions" | "access" | "grantUpdatedAt" | "updatedAt"> =>
  grant
    ? {
        permissions: parseMcpGrantPermissions(grant.permissions),
        access: accessOf(grant),
        grantUpdatedAt: grant.updatedAt,
        updatedAt: latest(consentUpdatedAt, grant.updatedAt),
      }
    : { permissions: null, access: null, grantUpdatedAt: null, updatedAt: consentUpdatedAt };

/**
 * The MCP clients the user authorized, most recently changed first: one per client with a consent, and one
 * per other grant the user holds (spec stories 29 and 38), so Revoke reaches every grant. That is a
 * `skipConsent` client, which never has a consent, capped by its registered scopes; or a client left with a
 * grant and no consent (switched off `skipConsent` after it was authorized), capped at nothing until the
 * user approves it again. Three reads up to the cap: the consents with their clients, then, side by
 * side, the grants of those clients and the user's other grants; past it, a fourth reads the consents the
 * cap cut short. Duplicate consent rows of one client fold into one entry, capped as a save caps it: by
 * what every row tied at the newest allows.
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
  const cutConsents = await readCutConsents(userId, consents, unconsentedGrants);
  const grantByClient = new Map(consentedGrants.map((grant) => [grant.clientId, grant]));
  const accessOf = (grant: TMcpGrantAccessRow) =>
    limitMcpGrantAccessToOptions(readMcpGrantAccessSelection(grant), accessOptions);

  const clients = new Map<string, TAuthorizedMcpClient>();
  for (const [clientId, rows] of groupByClient(consents)) {
    // Rows come newest first: the first holds the client and the consent's last change.
    const [newest] = rows;
    clients.set(clientId, {
      clientId,
      clientName: newest.client.name,
      clientUri: newest.client.uri,
      connectedAt: new Date(Math.min(...rows.map(({ createdAt }) => createdAt.getTime()))),
      cap: capForScopes(
        capScopes(newest.client, consentedScopesOf(cutConsents.get(clientId) ?? rows)),
        isDashboardViewer
      ),
      ...grantFields(grantByClient.get(clientId), newest.updatedAt, accessOf),
    });
  }
  for (const grant of unconsentedGrants) {
    clients.set(grant.clientId, {
      clientId: grant.clientId,
      clientName: grant.client.name,
      clientUri: grant.client.uri,
      connectedAt: grant.createdAt,
      cap: capForScopes(
        capScopes(grant.client, consentedScopesOf(cutConsents.get(grant.clientId) ?? [])),
        isDashboardViewer
      ),
      ...grantFields(grant, grant.updatedAt, accessOf),
    });
  }
  return [...clients.values()]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, MAX_LISTED_AUTHORIZED_MCP_CLIENTS);
};

export type TEditMcpGrantResult =
  | { status: "not_found" }
  | { status: "changed"; currentUpdatedAt: Date }
  | { status: "beyond_scopes" }
  | { status: "selection_unavailable"; field: "organizationIds" | "workspaceIds" }
  | {
      status: "saved";
      before: TStoredMcpGrant;
      after: TStoredMcpGrant;
      /** Prepared in the edit's transaction: queue them once it has committed. */
      audits: TMcpGrantAuditRecord[];
    };

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
 * Sets the user's grant to `clientId` (Authorized apps' Edit): `grant`'s permissions and, when it names
 * one, its organization & workspace access. Refused when the grant was saved since `expectedUpdatedAt`
 * (another tab or session changed it, and this save would undo that), when the user has no grant (or no
 * consent, for a client that needs one), when `grant.permissions` go above what the client's scopes ask
 * for (and, for a Dashboard viewer, what a viewer may give), and when `grant.access` adds an organization or workspace the user can't select; one the grant already selected
 * and the user has lost is dropped instead (`resolveMcpGrantSelection`).
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
  grant,
  expectedUpdatedAt,
  isDashboardViewer,
}: {
  userId: string;
  clientId: string;
  /** The grant to set: its permissions, and its access when the edit names one (ENG-7153). */
  grant: TRequestedMcpGrant;
  /** When the grant Edit opened was last saved: a grant saved since is not overwritten. */
  expectedUpdatedAt: Date;
  isDashboardViewer: boolean;
}): Promise<TEditMcpGrantResult> => {
  let grantId: string | null = null;
  try {
    const readableWorkspaceIds = await readMcpGrantReadableWorkspaceIds(userId, grant.access);
    const result = await prisma.$transaction(
      async (tx): Promise<TEditMcpGrantResult> => {
        const before = await lockMcpGrant(tx, { userId, clientId });
        if (!before) return { status: "not_found" };
        grantId = before.id;
        // Read under the row lock: a save from another tab or session either committed before it, and is
        // seen here, or waits for this one.
        const { updatedAt } = await tx.mcpGrant.findUniqueOrThrow({
          where: { id: before.id },
          select: { updatedAt: true },
        });
        if (updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
          return { status: "changed", currentUpdatedAt: updatedAt };
        }
        const scopes = await readCapScopes(tx, userId, clientId);
        if (!scopes) return { status: "not_found" };
        if (!isMcpGrantWithinCap(grant.permissions, capForScopes(scopes, isDashboardViewer))) {
          return { status: "beyond_scopes" };
        }
        let saved = grant.access;
        if (grant.access) {
          const resolved = await narrowMcpGrantAccess(tx, {
            userId,
            before,
            access: grant.access,
            readableWorkspaceIds,
          });
          if (resolved.status === "unavailable")
            return { status: "selection_unavailable", field: resolved.field };
          saved = resolved.access;
        }
        const written = await writeMcpGrant(tx, {
          userId,
          clientId,
          before,
          permissions: grant.permissions,
          access: saved,
        });
        const audits = await prepareMcpGrantAudits(tx, [{ action: "updated", before, after: written.after }]);
        return { status: "saved", before, after: written.after, audits };
      },
      { timeout: MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS }
    );
    if (result.status === "saved") await projectMcpGrants([result.after.id]);
    return result;
  } catch (error) {
    // A narrowing may have deleted relationships in SpiceDB before the transaction failed: repair the grant
    // from its committed rows, durably, so it doesn't stay narrower than they say.
    if (grantId) await repairMcpGrantsAfterFailedSave([grantId]);
    throw error;
  }
};
