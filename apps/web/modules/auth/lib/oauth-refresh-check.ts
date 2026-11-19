import "server-only";
import { APIError, isAPIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS } from "@/lib/authzed/mcp-grant-timeouts";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { getMcpGrantPermissionsForScopes, isMcpGrantEmpty } from "@/modules/mcp/grant";
import { hasMcpGrant, lockUserForMcpGrantWrite, shareLockMcpGrant } from "@/modules/mcp/grant-store";
import { revokeClientTokens } from "./mcp-grant-revocation";
import { MCP_OAUTH_REFRESH_TOKEN_PREFIX } from "./mcp-oauth-provider-options";
import { lockConsents, readConsentedScopes } from "./oauth-consent-rows";
import {
  type TPresentedRefreshToken,
  endTokensBeyondScopes,
  grantReachesBeyond,
  isCoveredBy,
} from "./oauth-consent-tokens";
import { isIssuedBeforeRevocation, readOAuthRevocationTime } from "./oauth-revocation-marker";

/**
 * The refresh check (`requireOAuthConsentOnRefreshAfterHandler`): after a refresh token is rotated, the
 * client's consent and grant must still cover it, and no Revoke may cover the presented token. See
 * `oauth-grant-revocation.ts` for why consent is the grant's liveness check and its bound.
 */

const TOKEN_PATH = "/oauth2/token";

/**
 * Better Auth stores refresh tokens as the unpadded base64url SHA-256 of the value after the prefix
 * (`storeTokens: "hashed"`, the provider's `defaultHasher`). Not exported upstream, so it is restated;
 * `oauth-grant-revocation.integration.test.ts` fails if a provider upgrade changes the format.
 */
const hashPresentedRefreshToken = (presented: string): string | null => {
  if (!presented.startsWith(MCP_OAUTH_REFRESH_TOKEN_PREFIX)) return null;
  return createHash("sha256")
    .update(presented.slice(MCP_OAUTH_REFRESH_TOKEN_PREFIX.length))
    .digest("base64url");
};

const invalidGrant = (): APIError =>
  new APIError("BAD_REQUEST", { error: "invalid_grant", error_description: "invalid refresh token" });

/** Why a refresh was refused, and what ending it ended: logged, never returned to the client. */
type TRefreshRefusal = Readonly<
  {
    reason: "client_revoked" | "token_revoked" | "grant_missing" | "consent_revoked" | "consent_narrowed";
  } & Partial<
    Record<
      "consentsDeleted" | "refreshTokensRevoked" | "refreshTokensDeleted" | "accessTokensRevoked",
      number
    >
  >
>;

/**
 * Whether a Revoke covers the presented refresh token: it was issued no later than the client's revocation
 * mark. Read under the user's row (`FOR KEY SHARE`), which a Revoke holds `FOR UPDATE` after it marks and
 * while it ends the client's tokens and grant: a Revoke in flight has marked by the time the mark is read,
 * and one that starts after this commits revokes the token this refresh inserted. The user's row comes
 * first, before the grant and the consent rows, the order every path that locks them takes.
 *
 * The mark, not the rows, decides: a Revoke whose token update missed this token (it rotated meanwhile)
 * and a new approval after it leave a grant and a consent that would pass every other check, and the token
 * this refresh minted would name the new grant.
 */
const isPresentedTokenRevoked = async (
  tx: Prisma.TransactionClient,
  { userId, clientId, createdAt }: { userId: string; clientId: string; createdAt: Date }
): Promise<boolean> => {
  await lockUserForMcpGrantWrite(tx, userId);
  return isIssuedBeforeRevocation(createdAt.getTime(), await readOAuthRevocationTime(userId, clientId));
};

/**
 * A refresh presenting a token a Revoke covers ({@link isPresentedTokenRevoked}): ends that token's chain
 * of rotations, the one just issued included, and every token beyond `scopes`. Leaves the client's other
 * tokens, such as those of an approval made after the Revoke, alone.
 */
const endRevokedToken = async (
  tx: Prisma.TransactionClient,
  args: {
    userId: string;
    clientId: string;
    consentedScopes: string[];
    presentedToken: TPresentedRefreshToken;
  }
): Promise<TRefreshRefusal> => ({ reason: "token_revoked", ...(await endTokensBeyondScopes(tx, args)) });

type TRefreshCheck = {
  userId: string;
  clientId: string;
  needsGrant: boolean;
  /** A Revoke covers the presented token ({@link isPresentedTokenRevoked}). */
  revoked: boolean;
  presentedToken: TPresentedRefreshToken;
};

/**
 * The refresh check of a `skipConsent` client, which has no consent to check: the revocation mark, then
 * its grant. A token without an MCP scope has no grant either, so the mark alone decides; a Revoke that
 * covers it ends every token of the client, as before grants. Otherwise a token the mark covers ends its
 * own chain, held to the scopes the client is registered with. `null` when the refresh stands.
 */
const checkSkipConsentRefresh = async (
  tx: Prisma.TransactionClient,
  { registeredScopes, ...check }: TRefreshCheck & { registeredScopes: string[] }
): Promise<TRefreshRefusal | null> => {
  const { userId, clientId, needsGrant, revoked, presentedToken } = check;
  if (!needsGrant) {
    return revoked ? { reason: "client_revoked", ...(await revokeClientTokens(tx, userId, clientId)) } : null;
  }
  if (revoked) {
    return endRevokedToken(tx, { userId, clientId, consentedScopes: registeredScopes, presentedToken });
  }
  // The grant is the connection's liveness check alone. Read `FOR SHARE` after issuance, as for a consent:
  // a Revoke still in flight is waited on and its delete seen, and one that commits later revokes the
  // token this refresh just inserted.
  if (await shareLockMcpGrant(tx, { userId, clientId })) return null;
  return { reason: "grant_missing", ...(await revokeClientTokens(tx, userId, clientId)) };
};

/**
 * A consent left without the grant an MCP token needs, written by the previous release during a rolling
 * upgrade: ended like a revoke, so the client goes back through the consent screen, where Allow writes
 * the grant. `null` when the grant is there after all, or no consent is. Locks the consent rows, then
 * reads the grant again: an approval saves the grant while holding these rows, so a grant it commits while
 * this waits is seen here rather than its client ended.
 */
const endGrantlessConsent = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<TRefreshRefusal | null> => {
  const consents = await lockConsents(tx, userId, { clientId }, "update");
  if (consents.length === 0 || (await hasMcpGrant(tx, { userId, clientId }))) return null;
  // No grant to delete: there is none, and none can be written while these rows are held.
  const deleted = await tx.oauthConsent.deleteMany({ where: { userId, clientId } });
  return {
    reason: "grant_missing",
    consentsDeleted: deleted.count,
    ...(await revokeClientTokens(tx, userId, clientId)),
  };
};

/**
 * The refresh check of a client with a consent: the grant an MCP token needs, then the consent, which
 * must still cover the presented token and every other token of its grant. `null` when the refresh
 * stands. The grant is locked first, then the consent rows, the order every path that locks both takes.
 */
const checkConsentedRefresh = async (
  tx: Prisma.TransactionClient,
  { userId, clientId, needsGrant, revoked, presentedToken }: TRefreshCheck
): Promise<TRefreshRefusal | null> => {
  // `FOR SHARE`: refreshes don't wait on each other, and a revoke or a save, which lock it `FOR UPDATE`,
  // wait on this check or it on them.
  if (needsGrant && !(await shareLockMcpGrant(tx, { userId, clientId }))) {
    const ended = await endGrantlessConsent(tx, userId, clientId);
    if (ended) return ended;
  }
  const consentedScopes = await readConsentedScopes(tx, userId, clientId);
  if (!consentedScopes) {
    return { reason: "consent_revoked", ...(await revokeClientTokens(tx, userId, clientId)) };
  }
  if (revoked) return endRevokedToken(tx, { userId, clientId, consentedScopes, presentedToken });
  const { authorizationCodeId, scopes } = presentedToken;
  const covered =
    isCoveredBy(scopes, consentedScopes) &&
    !(
      authorizationCodeId &&
      (await grantReachesBeyond(tx, { userId, clientId, grantId: authorizationCodeId, consentedScopes }))
    );
  if (covered) return null;
  return {
    reason: "consent_narrowed",
    ...(await endTokensBeyondScopes(tx, { userId, clientId, consentedScopes, presentedToken })),
  };
};

/**
 * `hooks.after` for `POST /oauth2/token`. After a successful `refresh_token` grant, checks the grant
 * still has consent, and that the consent still covers every scope of the presented refresh token.
 *
 *  - No consent (ENG-2499): revokes every token the client holds for the user (the one just issued
 *    included) and replaces the response with `invalid_grant`, so the new tokens never leave.
 *  - A consent with no MCP grant (ENG-7149): written by the previous release during a rolling upgrade.
 *    Ends the client's consent and tokens like a revoke and answers `invalid_grant`, so the client goes
 *    back through the consent screen, where Allow writes the grant. Without this, `/authorize` would keep
 *    skipping the screen on the grantless consent.
 *  - A consent narrowed below the token, or below any other token of its grant (ENG-3529): ends the
 *    client's tokens that reach past the consent and the presented token's whole grant (the one just
 *    issued included, even when the client asked for scopes the consent does cover), and answers
 *    `invalid_grant`. The client has to go back through `/authorize`, which only issues what the
 *    consent covers. Grants within the consent, such as the narrowed approval's own, keep working.
 *  - A presented token a Revoke covers (its revocation mark, `isPresentedTokenRevoked`), whatever grant
 *    and consent stand now: a Revoke whose token update missed a token rotated meanwhile, then a new
 *    approval, leave both in place. Ends that token's chain and answers `invalid_grant`; the new
 *    approval's own tokens, issued after the mark, keep working.
 *
 * It runs after issuance on purpose. A check before issuance could pass, then lose to a revoke that
 * commits before the new refresh token is inserted, leaving that token outside the revoke's update.
 * After issuance, the new token already exists, and the consent is read `FOR SHARE`: either the read
 * waits on an in-flight revoke's delete (or narrowing's update) and sees its result, or it ran before
 * it. In the second case the revoke's own token update comes later and catches the new token. The grant
 * is locked `FOR SHARE` before any consent row, the order every path that locks both takes.
 *
 * A client registered with `skipConsent`, which the provider authorizes without ever writing a consent
 * row, has no consent to check: its grant alone is checked, and a refresh of a connection without one
 * (revoked, or connected on a previous release during a rolling upgrade) is refused and its tokens
 * revoked, so the client authorizes again and the code exchange gives it a grant
 * (`mcpGrantAccessTokenClaims`). Fails closed if the presented token can't be matched to a row,
 * which after upstream accepted it only happens if the storage format has drifted.
 */
export const requireOAuthConsentOnRefreshAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== TOKEN_PATH) return;
  const body = ctx.body as { grant_type?: unknown; refresh_token?: unknown } | undefined;
  if (body?.grant_type !== "refresh_token" || typeof body.refresh_token !== "string") return;
  if (isAPIError((ctx.context as { returned?: unknown }).returned)) return;

  const storedToken = hashPresentedRefreshToken(body.refresh_token);
  const refreshToken = storedToken
    ? await prisma.oauthRefreshToken.findUnique({
        where: { token: storedToken },
        select: {
          userId: true,
          clientId: true,
          scopes: true,
          authorizationCodeId: true,
          rotatedAt: true,
          sessionId: true,
          createdAt: true,
          client: { select: { skipConsent: true, scopes: true } },
        },
      })
    : null;
  if (!refreshToken) {
    // Either a narrowing or revoke ended the token while this refresh was in flight, or the provider's
    // storage format has drifted (the integration suite catches the latter). Fail closed either way.
    logger.warn("OAuth refresh token no longer stored: ended concurrently, or the storage format drifted");
    throw invalidGrant();
  }
  const { userId, clientId, scopes, authorizationCodeId, rotatedAt, sessionId, createdAt } = refreshToken;
  // A token without an MCP scope can't call `/api/mcp`, and its client was given no grant (an approval
  // saves none for it): only its consent is checked.
  const needsGrant = !isMcpGrantEmpty(getMcpGrantPermissionsForScopes(scopes));
  const presentedToken = { authorizationCodeId, rotatedAt, sessionId, scopes };
  const refused = await prisma.$transaction(
    async (tx) => {
      const revoked = await isPresentedTokenRevoked(tx, { userId, clientId, createdAt });
      const check = { userId, clientId, needsGrant, revoked, presentedToken };
      return refreshToken.client.skipConsent
        ? checkSkipConsentRefresh(tx, { ...check, registeredScopes: refreshToken.client.scopes })
        : checkConsentedRefresh(tx, check);
    },
    // It takes the user's row or the client's grant row, either of which a Revoke can hold while it waits
    // behind a reconciling pass: on the default budget the refresh would fail after rotating, and the
    // client lose its token over another client's Revoke.
    { timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS }
  );
  if (!refused) return;

  logger.warn(
    { userId, clientId, ...refused },
    "OAuth refresh refused: its consent or grant no longer covers it"
  );
  throw invalidGrant();
};
