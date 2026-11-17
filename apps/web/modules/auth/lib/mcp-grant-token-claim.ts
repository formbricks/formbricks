import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS } from "@/lib/authzed/mcp-grant-timeouts";
import { isOnlyDashboardViewer } from "@/lib/membership/dashboard-viewer";
import { loggableError } from "@/lib/utils/loggable-error";
import { getUnconsentedMcpGrantPermissions, isMcpGrantEmpty } from "@/modules/mcp/grant";
import {
  createMcpGrantIfMissing,
  lockUserForMcpGrantWrite,
  queueMcpGrantAudit,
} from "@/modules/mcp/grant-store";
import { trimScopesForDashboardViewer } from "./dashboard-viewer-oauth-scopes";
import {
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
 * creates one: the refresh check (`requireOAuthConsentOnRefreshAfterHandler`) ends a `skipConsent`
 * client without a grant, so a refresh that raced a Revoke can't bring it back.
 *
 * The creation is ordered against a Revoke like every other grant write ({@link grantSkipConsentClient}): it
 * takes the user's row `FOR KEY SHARE`, which a revocation holds `FOR UPDATE` while it deletes, and re-reads
 * the revocation mark once it has it. The token endpoint's before-hook read the mark before the provider
 * spent the code, so a Revoke that committed between the two would otherwise leave the client with a new
 * grant and its revoked access back (`oauth-revocation-marker.ts`).
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
 * Gives the user a grant to a `skipConsent` client if they have none, unless a revocation covers the code
 * being exchanged. Never throws: the code is already spent, and failing the exchange would leave the client
 * nothing to retry with. Without a grant the token carries no claim, its calls are refused, and its next
 * refresh ends its access, so it authorizes again.
 *
 * The exchange's own read of the mark (`readExchangedAuthorizationCode`) supplies the code's issue time;
 * without it, nothing is created, which is the same fail-closed answer if the hook ever stops recording it.
 */
const grantSkipConsentClient = async (userId: string, clientId: string, scopes: string[]): Promise<void> => {
  try {
    const exchanged = await readExchangedAuthorizationCode();
    if (!exchanged || exchanged.userId !== userId || exchanged.clientId !== clientId) {
      logger.warn(
        { userId, clientId },
        "No authorization code recorded for this exchange, so no grant was created for the skipConsent client"
      );
      return;
    }
    const granted = (await isOnlyDashboardViewer(prisma, userId))
      ? trimScopesForDashboardViewer(scopes)
      : scopes;
    // A client that asked for no MCP scope gets no grant: it couldn't use one, and its refresh needs none.
    const permissions = getUnconsentedMcpGrantPermissions(granted);
    if (isMcpGrantEmpty(permissions)) return;
    const created = await prisma.$transaction(
      async (tx) => {
        // The lock a revocation waits on, before the mark is read: a Revoke that wrote its mark first is
        // seen here, and one that starts after this commits deletes the grant below with the rest.
        await lockUserForMcpGrantWrite(tx, userId);
        const revokedAt = await readOAuthRevocationTime(userId, clientId);
        if (isIssuedBeforeRevocation(exchanged.issuedAt, revokedAt)) return null;
        return createMcpGrantIfMissing(tx, { userId, clientId, permissions });
        // The user's row can be held by a Revoke waiting behind a reconciling pass.
      },
      { timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS }
    );
    if (!created) return;
    await queueMcpGrantAudit({ action: "created", actorUserId: userId, before: null, after: created });
  } catch (error) {
    // A known Prisma error is the expected case (the user or the client deleted meanwhile, a lost race on
    // the unique key) and is a warning; anything else is a fault and is logged as an error.
    const expected = error instanceof Prisma.PrismaClientKnownRequestError;
    logger[expected ? "warn" : "error"](
      { err: loggableError(error), userId, clientId },
      "Saving the grant of a skipConsent MCP client failed"
    );
  }
};

/**
 * The access-token claims for the grant the token is issued under: its id, or `null` while the user
 * has no grant to the client. Nothing without a user (a client credentials token, which no MCP call accepts).
 */
export const mcpGrantAccessTokenClaims = async ({
  user,
  client,
  scopes,
  grantType,
}: TClaimInput): Promise<Record<string, unknown>> => {
  if (!user) return {};
  if (grantType === "authorization_code" && client.skipConsent === true) {
    await grantSkipConsentClient(user.id, client.clientId, scopes);
  }
  const grant = await prisma.mcpGrant.findUnique({
    where: { userId_clientId: { userId: user.id, clientId: client.clientId } },
    select: { id: true },
  });
  return { [MCP_GRANT_TOKEN_CLAIM]: grant?.id ?? null };
};
