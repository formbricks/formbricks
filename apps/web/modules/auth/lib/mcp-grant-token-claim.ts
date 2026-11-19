import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { loggableError } from "@/lib/utils/loggable-error";
import { getUnconsentedMcpGrantPermissions, isMcpGrantEmpty } from "@/modules/mcp/grant";
import { queueMcpGrantAudit } from "@/modules/mcp/grant-audit";
import { createMcpGrantIfMissing, lockUserForMcpGrantWrite } from "@/modules/mcp/grant-store";
import { trimScopesForDashboardViewer } from "./dashboard-viewer-oauth-scopes";
import {
  type TExchangedCode,
  isIssuedBeforeRevocation,
  readExchangedAuthorizationCode,
  readOAuthRevocationTime,
} from "./oauth-revocation-marker";

/**
 * The grant an MCP access token is issued under (ADR-0041), as a claim of the token.
 *
 * A grant is keyed on the user and the client, so Revoke followed by a new approval makes a new grant
 * under the same key. `/api/mcp` reads the grant on every call, and a token from before the Revoke would
 * find the new one. Comparing issue times can't settle it: `iat` counts whole seconds and comes from the
 * issuing pod's clock. So every access token carries the id of the grant it was issued under, and
 * `/api/mcp` refuses a token whose grant is not the user's grant to the client now (`isIssuedUnderGrant` in
 * `modules/mcp/auth.ts`).
 *
 * An access-token claim contributor of the provider (`extensions[].claims.accessToken`), called while it
 * mints each access token, after it has checked the code or refresh token. A token minted while the
 * user has no grant to the client names none (`mcp_grant: null`), so no grant made later takes it in. Only a token
 * from the previous release has no claim at all, and only those are checked by their issue time.
 *
 * A grant for a `skipConsent` client too. Allow on the consent screen saves a client's grant, and a client
 * registered with `skipConsent` (a trusted first-party client) is authorized without that screen. So an
 * authorization code exchanged by such a client gives the user a grant to the client if they have none, before its
 * token is minted, by the rule the grant migration applied to clients connected before grants: All access,
 * every permission at its scope family's level, Tags and Audience at No access
 * (`getUnconsentedMcpGrantPermissions`). A Dashboard viewer's scopes are trimmed first, as the consent
 * screen does. A grant that exists, or that the user narrowed with Edit, is left alone. A refresh never
 * creates one, and names whatever grant stands: the refresh check (`requireOAuthConsentOnRefreshAfterHandler`)
 * runs after it, ends a `skipConsent` client without a grant, and refuses a presented token a Revoke's mark
 * covers, so a refresh that raced a Revoke and a new approval never leaves with a token naming the new grant.
 *
 * A code exchange names its grant, and creates one, under the same order every other grant write keeps
 * against a Revoke ({@link readCodeExchangeGrantId}, {@link grantSkipConsentClient}): it takes the user's row
 * `FOR KEY SHARE`, which a revocation holds `FOR UPDATE` while it deletes, and re-reads the revocation mark
 * once it has it. The token endpoint's before-hook read the mark before the provider spent the code, so a
 * Revoke that committed between the two, and an approval after it, would otherwise give a token from the
 * revoked code the new approval's grant, or give the client a new grant and its revoked access back
 * (`oauth-revocation-marker.ts`).
 */
export const MCP_GRANT_TOKEN_CLAIM = "mcp_grant";

/** What the provider passes a claim contributor that this one reads. */
type TClaimInput = {
  user?: { id: string } | null;
  client: { clientId: string; skipConsent?: boolean | null };
  scopes: string[];
  grantType?: string;
};

/**
 * The authorization code this exchange spends, as the token endpoint's before-hook read it, when it is the
 * user's code for this client; `null` otherwise, which the callers treat as covered by a revocation.
 */
const readExchangedCodeFor = async (userId: string, clientId: string): Promise<TExchangedCode | null> => {
  const exchanged = await readExchangedAuthorizationCode();
  return exchanged?.userId === userId && exchanged.clientId === clientId ? exchanged : null;
};

/**
 * How long a code exchange waits for the user's row, which a Revoke or a member removal holds `FOR UPDATE`
 * while it ends grants (up to `MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS` behind a reconciling pass), and how
 * long its transaction may run. The provider has already spent the code, so the exchange can't be failed
 * and retried: one that can't get the row in time issues its token naming no grant instead (fail closed;
 * see {@link readCodeExchangeGrantId} for how the client recovers). Short, so a slow Revoke never stalls
 * every exchange of the user.
 */
const CODE_EXCHANGE_LOCK_TIMEOUT_MS = 2_000;
const CODE_EXCHANGE_LOCK_TIMEOUT = `${CODE_EXCHANGE_LOCK_TIMEOUT_MS}ms`;
const CODE_EXCHANGE_TRANSACTION_TIMEOUT_MS = 5_000;

/**
 * Runs `step` in a transaction that holds the user's row `FOR KEY SHARE`, the lock a revocation waits on
 * with `FOR UPDATE`, waiting for it at most {@link CODE_EXCHANGE_LOCK_TIMEOUT_MS}. A Revoke that wrote its
 * mark before this took the row is seen by a mark read in `step`; one that starts after this commits waits
 * for it, then deletes what `step` named or created.
 */
const underUserRow = <T>(userId: string, step: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('lock_timeout', ${CODE_EXCHANGE_LOCK_TIMEOUT}, true)`;
      await lockUserForMcpGrantWrite(tx, userId);
      return step(tx);
    },
    { timeout: CODE_EXCHANGE_TRANSACTION_TIMEOUT_MS }
  );

/** The id of the user's grant to the client, or `null` without one. */
const readGrantId = async (
  db: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<string | null> =>
  (await db.mcpGrant.findUnique({ where: { userId_clientId: { userId, clientId } }, select: { id: true } }))
    ?.id ?? null;

/**
 * Gives the user a grant to a `skipConsent` client if they have none, unless a revocation covers the code
 * being exchanged. Never throws: the code is already spent, and failing the exchange would leave the client
 * nothing to retry with. Without a grant the token carries no claim, its calls are refused, and its next
 * refresh ends its access, so it authorizes again.
 */
const grantSkipConsentClient = async (
  userId: string,
  clientId: string,
  scopes: string[],
  exchanged: TExchangedCode
): Promise<void> => {
  try {
    const granted = (await isOnlyDashboardViewer(prisma, userId))
      ? trimScopesForDashboardViewer(scopes)
      : scopes;
    // A client that asked for no MCP scope gets no grant: it couldn't use one, and its refresh needs none.
    const permissions = getUnconsentedMcpGrantPermissions(granted);
    if (isMcpGrantEmpty(permissions)) return;
    const created = await underUserRow(userId, async (tx) => {
      const revokedAt = await readOAuthRevocationTime(userId, clientId);
      if (isIssuedBeforeRevocation(exchanged.issuedAt, revokedAt)) return null;
      return createMcpGrantIfMissing(tx, { userId, clientId, permissions });
    });
    if (!created) return;
    await queueMcpGrantAudit({ action: "created", actorUserId: userId, before: null, after: created });
  } catch (error) {
    // A known Prisma error is the expected case (the user or the client deleted meanwhile, a lost race on
    // the unique key, the user's row held past the lock timeout) and is a warning; anything else is a fault
    // and is logged as an error.
    const expected = error instanceof Prisma.PrismaClientKnownRequestError;
    logger[expected ? "warn" : "error"](
      { err: loggableError(error), userId, clientId },
      "Saving the grant of a skipConsent MCP client failed"
    );
  }
};

/**
 * The grant a token minted from an authorization code is issued under, or `null` when a revocation covers
 * the code. Reads the mark and the grant under the user's row ({@link underUserRow}): a Revoke that marked
 * after the before-hook's read is seen here, and one that starts later waits for this read and then deletes
 * the grant it named. Otherwise a Revoke and a new approval landing between the two would hand the revoked
 * code's token the new approval's grant.
 *
 * Never throws, as the provider has already spent the code: when the row isn't free within the lock
 * timeout, the transaction runs out, or the mark can't be read, the token names no grant. `/api/mcp` refuses such a token until the client refreshes: a refresh names the grant
 * the user holds, so a client whose grant stands recovers then, while a `skipConsent` client whose grant
 * creation failed too has none, is refused at that refresh, and authorizes again.
 * A token whose code a Revoke covers recovers nowhere: the refresh check ends its tokens.
 */
const readCodeExchangeGrantId = async (
  userId: string,
  clientId: string,
  exchanged: TExchangedCode
): Promise<string | null> => {
  try {
    return await underUserRow(userId, async (tx) => {
      const revokedAt = await readOAuthRevocationTime(userId, clientId);
      if (isIssuedBeforeRevocation(exchanged.issuedAt, revokedAt)) return null;
      return readGrantId(tx, userId, clientId);
    });
  } catch (error) {
    // A known Prisma error is the expected case (the user's row held past the lock timeout, the
    // transaction run out) and is a warning; anything else, such as Redis failing, is a fault.
    const expected = error instanceof Prisma.PrismaClientKnownRequestError;
    logger[expected ? "warn" : "error"](
      { err: loggableError(error), userId, clientId },
      "Reading the grant of an MCP code exchange failed, so its token names no grant"
    );
    return null;
  }
};

/**
 * The access-token claims for the grant the token is issued under: its id, or `null` while the user
 * has no grant to the client. Nothing without a user (a client credentials token, which no MCP call accepts).
 *
 * A code exchange without the before-hook's record of its code names no grant (fail closed): there is no
 * issue time to check the revocation mark against.
 */
export const mcpGrantAccessTokenClaims = async ({
  user,
  client,
  scopes,
  grantType,
}: TClaimInput): Promise<Record<string, unknown>> => {
  if (!user) return {};
  const { clientId } = client;
  if (grantType !== "authorization_code") {
    return { [MCP_GRANT_TOKEN_CLAIM]: await readGrantId(prisma, user.id, clientId) };
  }
  const exchanged = await readExchangedCodeFor(user.id, clientId);
  if (!exchanged) {
    logger.warn(
      { userId: user.id, clientId },
      "No authorization code recorded for this exchange, so its token names no grant"
    );
    return { [MCP_GRANT_TOKEN_CLAIM]: null };
  }
  if (client.skipConsent === true) await grantSkipConsentClient(user.id, clientId, scopes, exchanged);
  return { [MCP_GRANT_TOKEN_CLAIM]: await readCodeExchangeGrantId(user.id, clientId, exchanged) };
};
