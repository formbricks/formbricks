import "server-only";
import { APIError, getSessionFromCtx, isAPIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { MCP_OAUTH_REFRESH_TOKEN_PREFIX } from "./mcp-oauth-provider-options";

/**
 * ENG-2499: revoking an app on Authorized Apps has to end the app's access, not just hide it.
 *
 * Better Auth's `deleteConsentEndpoint` deletes the `oauthConsent` row and nothing else, and its
 * `refresh_token` grant never looks at consent. Each rotation also issues a fresh 30-day refresh token,
 * so a "revoked" client that refreshed at least monthly kept access indefinitely. Two hooks fix it:
 *
 *  - {@link revokeOAuthConsentBeforeHandler} replaces the upstream delete, for the HTTP route and
 *    `auth.api.deleteOAuthConsent` alike, with one transaction that deletes the consent and revokes the
 *    client's tokens.
 *  - {@link requireOAuthConsentOnRefreshAfterHandler} makes consent the grant's liveness check: a
 *    refresh that succeeds for a (user, client) with no consent is revoked and answered `invalid_grant`.
 *    That closes the race with a refresh in flight during the revoke, and ends the grants of every app
 *    revoked before this fix, at their next refresh.
 *
 * Access tokens are self-contained JWTs verified against JWKS (`modules/mcp/auth.ts`), so one minted
 * before the revoke stays valid until it expires (`accessTokenExpiresIn`, 15 minutes). That residual
 * is the same one `sso-recovery.ts` accepts; the `oauthAccessToken` write below only matters for opaque
 * tokens.
 */

/**
 * End every OAuth grant a user holds, in the caller's transaction: their consents go and their access and
 * refresh tokens are marked revoked. Used when the account changes hands (SSO recovery) or is switched
 * off (the data retention members policy).
 *
 * The REFRESH token is the one that matters and the one this actually stops: `handleRefreshTokenGrant`
 * reads `revoked`, so revoking it ends the 30-day persistence. Both token tables' `session` FK is
 * `onDelete: SetNull`, so revoking sessions alone would blank the liveness check rather than fail it.
 *
 * ACCESS tokens are a different story, and worth stating plainly rather than implying this covers them.
 * Our config sets `resources` and never sets `disableJwtPlugin`, so `isJwtAccessToken` is always true
 * and every access token is a self-contained JWT: `createJwtAccessToken` signs without persisting, so
 * there is normally no row here to update, and `/api/mcp` verifies bearers against JWKS
 * (`modules/mcp/auth.ts`) without reading this table at all. Upstream's own revoke endpoint says as
 * much — "JWT access tokens are self-contained and cannot be revoked server-side". The access-token
 * write is therefore defence for the opaque-token configuration only; the residual is that a JWT stays
 * valid for up to `accessTokenExpiresIn` (15 min).
 *
 * Consent goes too: `/authorize` skips the consent screen when a matching `oauthConsent` row exists, so
 * leaving it would let a still-cookie-cached session (see session-revocation.ts) silently mint a fresh
 * 30-day refresh token and undo the revocation.
 */
export const revokeAllUserOAuthGrants = async (
  tx: Prisma.TransactionClient,
  userId: string,
  revokedAt: Date = new Date()
): Promise<{ accessTokensRevoked: number; refreshTokensRevoked: number; consentsDeleted: number }> => {
  // Consents first, as `revokeOAuthConsentBeforeHandler` does: a refresh in flight that lands between
  // the two then fails its consent check instead of minting a token after the revocation.
  const consentRows = await tx.oauthConsent.deleteMany({ where: { userId } });
  const accessRows = await tx.oauthAccessToken.updateMany({
    where: { userId, revoked: null },
    data: { revoked: revokedAt },
  });
  const refreshRows = await tx.oauthRefreshToken.updateMany({
    where: { userId, revoked: null },
    data: { revoked: revokedAt },
  });
  return {
    accessTokensRevoked: accessRows.count,
    refreshTokensRevoked: refreshRows.count,
    consentsDeleted: consentRows.count,
  };
};

const CONSENT_DELETE_PATH = "/oauth2/delete-consent";
const TOKEN_PATH = "/oauth2/token";

type TRevokedGrant = { consentsDeleted: number; refreshTokensRevoked: number; accessTokensRevoked: number };

const revokeClientTokens = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<Omit<TRevokedGrant, "consentsDeleted">> => {
  const revoked = new Date();
  const refreshRows = await tx.oauthRefreshToken.updateMany({
    where: { userId, clientId, revoked: null },
    data: { revoked },
  });
  const accessRows = await tx.oauthAccessToken.updateMany({
    where: { userId, clientId, revoked: null },
    data: { revoked },
  });
  return { refreshTokensRevoked: refreshRows.count, accessTokensRevoked: accessRows.count };
};

/**
 * Deletes the user's consent for the consent's client and revokes every token that client holds for
 * them. Returns `null` when the consent doesn't exist or belongs to someone else — one answer for both,
 * so the id can't be probed.
 *
 * Scoped to the client rather than the single consent row: Authorized Apps lists and revokes apps, and a
 * leftover consent for the same client would let `/authorize` skip the consent screen.
 *
 * The consent rows are deleted BEFORE the tokens are revoked, and the order is load-bearing: the delete
 * takes the row locks that {@link requireOAuthConsentOnRefreshAfterHandler}'s `FOR SHARE` read waits on.
 * A refresh that rotates in the gap between the token update and the commit therefore can't read the
 * consent as still present.
 */
export const revokeOAuthConsentGrant = async ({
  userId,
  consentId,
}: {
  userId: string;
  consentId: string;
}): Promise<TRevokedGrant | null> =>
  prisma.$transaction(async (tx) => {
    const consent = await tx.oauthConsent.findFirst({
      where: { id: consentId, userId },
      select: { clientId: true },
    });
    if (!consent) return null;

    const consents = await tx.oauthConsent.deleteMany({ where: { userId, clientId: consent.clientId } });
    const tokens = await revokeClientTokens(tx, userId, consent.clientId);
    return { consentsDeleted: consents.count, ...tokens };
  });

/**
 * `hooks.before` for `POST /oauth2/delete-consent`. Performs the whole revocation and short-circuits
 * the upstream endpoint, which would only delete the consent. Returns `undefined` for every other path.
 */
export const revokeOAuthConsentBeforeHandler = async (
  ctx: AuthHookContext
): Promise<{ success: true } | undefined> => {
  if (ctx.path !== CONSENT_DELETE_PATH) return undefined;

  const session = await getSessionFromCtx(ctx);
  if (!session) throw new APIError("UNAUTHORIZED");

  const consentId = (ctx.body as { id?: unknown } | undefined)?.id;
  if (typeof consentId !== "string" || consentId.length === 0) {
    throw new APIError("NOT_FOUND", { error: "not_found", error_description: "missing id parameter" });
  }

  const revoked = await revokeOAuthConsentGrant({ userId: session.user.id, consentId });
  if (!revoked) throw new APIError("NOT_FOUND", { error: "not_found", error_description: "no consent" });

  logger.info({ userId: session.user.id, consentId, ...revoked }, "OAuth consent revoked with its tokens");
  return { success: true };
};

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

/**
 * `hooks.after` for `POST /oauth2/token`. After a successful `refresh_token` grant, checks the grant
 * still has consent. If it doesn't, revokes every token the client holds for the user (the one just
 * issued included) and replaces the response with `invalid_grant`, so the new tokens never leave.
 *
 * It runs after issuance on purpose. A check before issuance could pass, then lose to a revoke that
 * commits before the new refresh token is inserted, leaving that token outside the revoke's update.
 * After issuance, the new token already exists, and the consent is read `FOR SHARE`: either the read
 * waits on an in-flight revoke's delete and finds the consent gone, or it ran before that delete. In
 * the second case the revoke's own token update comes later and catches the new token.
 *
 * Exempt: clients registered with `skipConsent`, which the provider authorizes without ever writing a
 * consent row. Fails closed if the presented token can't be matched to a row, which after upstream
 * accepted it only happens if the storage format has drifted.
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
        select: { userId: true, clientId: true, client: { select: { skipConsent: true } } },
      })
    : null;
  if (!refreshToken) {
    logger.error("OAuth refresh succeeded but its refresh token could not be matched to a stored row");
    throw invalidGrant();
  }
  if (refreshToken.client.skipConsent) return;

  const { userId, clientId } = refreshToken;
  const revoked = await prisma.$transaction(async (tx) => {
    const consent = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "oauthConsent"
      WHERE "userId" = ${userId} AND "clientId" = ${clientId}
      LIMIT 1
      FOR SHARE`;
    if (consent.length > 0) return null;
    return revokeClientTokens(tx, userId, clientId);
  });
  if (!revoked) return;

  logger.warn({ userId, clientId, ...revoked }, "OAuth refresh refused: the grant's consent was revoked");
  throw invalidGrant();
};
