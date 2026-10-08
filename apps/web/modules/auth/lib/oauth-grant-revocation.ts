import "server-only";
import { getOAuthProviderState } from "@better-auth/oauth-provider";
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
 * ENG-3529: narrowing an app's consent has to narrow its access too. Approving an app again with fewer
 * scopes (`/oauth2/consent`), or editing the consent (`/oauth2/update-consent`), replaces the consent's
 * scopes and leaves every token from earlier, wider approvals live. So consent is also the bound on a
 * grant's scopes, not just its liveness:
 *
 *  - {@link revokeTokensBeyondConsentAfterHandler} ends the client's tokens that reach past the consent
 *    as soon as it is narrowed.
 *  - The refresh check refuses a refresh token whose scopes the consent no longer covers, and ends the
 *    tokens beyond it, for the same race and for grants narrowed before this fix.
 *
 * Access tokens are self-contained JWTs verified against JWKS (`modules/mcp/auth.ts`), so one minted
 * before the revoke stays valid until it expires (`accessTokenExpiresIn`, 15 minutes). That residual
 * is the same one `sso-recovery.ts` accepts; the `oauthAccessToken` write below only matters for opaque
 * tokens. An authorization code issued under the wider consent and redeemed after the narrowing has
 * the same residual, started up to its 10-minute code lifetime later: its access token lives out its 15
 * minutes, and its refresh token is refused on first use.
 */

const CONSENT_PATH = "/oauth2/consent";
const CONSENT_UPDATE_PATH = "/oauth2/update-consent";
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

type TConsentRow = { id: string; scopes: string[]; updatedAt: Date };

/**
 * Locks the user's consent rows for the client, in `id` order. Every path that locks several of them
 * (this module's three, upstream writes only one row at a time) takes them in that order, so a refresh
 * racing a revoke or a narrowing waits instead of deadlocking.
 */
const lockConsents = (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string,
  mode: "share" | "update"
): Promise<TConsentRow[]> =>
  mode === "update"
    ? tx.$queryRaw<TConsentRow[]>`
        SELECT "id", "scopes", "updatedAt" FROM "oauthConsent"
        WHERE "userId" = ${userId} AND "clientId" = ${clientId}
        ORDER BY "id"
        FOR UPDATE`
    : tx.$queryRaw<TConsentRow[]>`
        SELECT "id", "scopes", "updatedAt" FROM "oauthConsent"
        WHERE "userId" = ${userId} AND "clientId" = ${clientId}
        ORDER BY "id"
        FOR SHARE`;

/**
 * The scopes a set of consent rows allows, and the row that decision rests on; `null` without a row.
 *
 * Normally one row: the provider finds the (user, client) consent and updates it. Two concurrent first
 * approvals can each insert one, though, and a later approval or `update-consent` then rewrites only one
 * of them. The bound is the most recently written row, the user's latest decision. The provider stamps
 * `updatedAt` to the second, so rows written in the same second can't be ordered, and the bound is then
 * what all of them allow. Picked here rather than by `ORDER BY`, which sorts before a waited-on row's
 * new values come back.
 */
const consentBound = (consents: TConsentRow[]): { scopes: string[]; newest: TConsentRow } | null => {
  if (consents.length === 0) return null;
  const newestAt = Math.max(...consents.map((consent) => consent.updatedAt.getTime()));
  const newest = consents.filter((consent) => consent.updatedAt.getTime() === newestAt);
  const scopes = newest[0].scopes.filter((scope) =>
    newest.every((consent) => consent.scopes.includes(scope))
  );
  return { scopes, newest: newest[0] };
};

/**
 * The scopes the user has consented to for the client, or `null` without a consent. Read `FOR SHARE`,
 * so a consent delete or narrowing that is still in flight is waited on rather than read around.
 */
const readConsentedScopes = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<string[] | null> =>
  consentBound(await lockConsents(tx, userId, clientId, "share"))?.scopes ?? null;

/**
 * Like {@link readConsentedScopes}, for the consent hook, which also folds duplicate rows into the one
 * the bound rests on. The provider's `/authorize` looks a consent up with an unordered `findOne`, so a
 * stale wider duplicate would otherwise keep skipping the consent screen and minting wide codes after
 * the user narrowed the other row.
 */
const settleConsentedScopes = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<string[] | null> => {
  const consents = await lockConsents(tx, userId, clientId, "update");
  const bound = consentBound(consents);
  if (!bound || consents.length === 1) return bound?.scopes ?? null;

  await tx.oauthConsent.deleteMany({ where: { userId, clientId, id: { not: bound.newest.id } } });
  if (bound.scopes.length !== bound.newest.scopes.length) {
    await tx.oauthConsent.update({ where: { id: bound.newest.id }, data: { scopes: bound.scopes } });
  }
  return bound.scopes;
};

type TTokensBeyondConsent = { refreshTokensDeleted: number; accessTokensRevoked: number };

/**
 * The grant a refused refresh belongs to, so the tokens minted for that request end too. Grants from
 * Better Auth 1.7 on carry an `authorizationCodeId` shared by every rotation. Older ones have none, so the
 * one refresh token minted for the request is found by what rotation stamps on it: its `createdAt` is
 * the presented token's `rotatedAt`, in the same session.
 */
type TRefusedGrant = { authorizationCodeId: string | null; rotatedAt: Date | null; sessionId: string | null };

/**
 * Ends the client's tokens for the user that reach past `consentedScopes`, and every other token of the
 * grants they belong to (one approval's chain of rotations, shared `authorizationCodeId`). A grant ends
 * whole: a refresh may have asked for fewer scopes, leaving a child inside the consent whose ancestor
 * isn't, and that child must not outlive the token it was minted from. The narrowed approval's own grant
 * has a new id, so it is untouched. When a refused refresh's `grant` is given, that grant ends too.
 * Prisma's list filters can't express "not a subset of", hence the raw `<@`.
 *
 * Refresh tokens are deleted rather than marked revoked, rotated ones included. The provider reads a
 * revoked refresh token presented again as a stolen one and deletes every refresh token the client holds
 * for the user, so a client still holding a token from before the narrowing would take the narrowed
 * grant down with it. A deleted token is answered `invalid_grant` and nothing else. Access tokens have
 * no such reuse check, and are revoked like the rest of this module's. Those minted from a refresh token
 * about to be deleted are counted here; the `refreshId` cascade then removes them.
 */
const endTokensBeyondScopes = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    consentedScopes,
    grant = { authorizationCodeId: null, rotatedAt: null, sessionId: null },
  }: { userId: string; clientId: string; consentedScopes: string[]; grant?: TRefusedGrant }
): Promise<TTokensBeyondConsent> => {
  const { authorizationCodeId, rotatedAt, sessionId } = grant;
  const beyond = await tx.$queryRaw<{ grantId: string }[]>`
    SELECT "authorizationCodeId" AS "grantId" FROM "oauthRefreshToken"
    WHERE "userId" = ${userId} AND "clientId" = ${clientId}
      AND "authorizationCodeId" IS NOT NULL AND NOT ("scopes" <@ ${consentedScopes}::text[])
    UNION
    SELECT "authorizationCodeId" FROM "oauthAccessToken"
    WHERE "userId" = ${userId} AND "clientId" = ${clientId}
      AND "authorizationCodeId" IS NOT NULL AND NOT ("scopes" <@ ${consentedScopes}::text[])`;
  const grantIds = [
    ...beyond.map((row) => row.grantId),
    ...(authorizationCodeId ? [authorizationCodeId] : []),
  ];
  // Without a refused grant, `rotatedAt` is null and `"createdAt" = NULL` never matches.
  const ending = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "oauthRefreshToken"
    WHERE "userId" = ${userId} AND "clientId" = ${clientId}
      AND (NOT ("scopes" <@ ${consentedScopes}::text[])
        OR "authorizationCodeId" = ANY(${grantIds}::text[])
        OR (${authorizationCodeId}::text IS NULL AND "authorizationCodeId" IS NULL
          AND "createdAt" = ${rotatedAt} AND "sessionId" IS NOT DISTINCT FROM ${sessionId}))
    ORDER BY "id"
    FOR UPDATE`;
  const refreshIds = ending.map((row) => row.id);
  const accessTokensRevoked = await tx.$executeRaw`
    UPDATE "oauthAccessToken" SET "revoked" = ${new Date()}
    WHERE "userId" = ${userId} AND "clientId" = ${clientId} AND "revoked" IS NULL
      AND (NOT ("scopes" <@ ${consentedScopes}::text[])
        OR "authorizationCodeId" = ANY(${grantIds}::text[])
        OR "refreshId" = ANY(${refreshIds}::text[]))`;
  const refreshTokensDeleted = await tx.$executeRaw`
    DELETE FROM "oauthRefreshToken" WHERE "id" = ANY(${refreshIds}::text[])`;
  return { refreshTokensDeleted, accessTokensRevoked };
};

const isCoveredBy = (scopes: string[], consentedScopes: string[]): boolean =>
  scopes.every((scope) => consentedScopes.includes(scope));

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

    // Locked in id order first, as every other path here does, so a racing refresh waits rather than
    // deadlocking against a delete that would take the rows in scan order.
    await lockConsents(tx, userId, consent.clientId, "update");
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
 * The client whose consent a successful `/oauth2/consent` or `/oauth2/update-consent` may have changed,
 * or `null` for any other request. For `/oauth2/consent`, the client id comes from the provider's own
 * request state, the verified authorization query the endpoint itself read the client from.
 */
const changedConsentClientId = async (ctx: AuthHookContext, userId: string): Promise<string | null> => {
  if (ctx.path === CONSENT_PATH) {
    if ((ctx.body as { accept?: unknown } | undefined)?.accept !== true) return null;
    const query = (await getOAuthProviderState())?.query;
    return query ? new URLSearchParams(query).get("client_id") : null;
  }
  if (ctx.path === CONSENT_UPDATE_PATH) {
    const consentId = (ctx.body as { id?: unknown } | undefined)?.id;
    if (typeof consentId !== "string") return null;
    const consent = await prisma.oauthConsent.findFirst({
      where: { id: consentId, userId },
      select: { clientId: true },
    });
    return consent?.clientId ?? null;
  }
  return null;
};

/**
 * `hooks.after` for `POST /oauth2/consent` and `POST /oauth2/update-consent`. Once the provider has
 * written the consent, ends the client's tokens for the user that reach past it, so a narrowed approval
 * takes effect now rather than at each token's next refresh.
 *
 * It reconciles against the stored consent rather than the request, so it runs whatever the provider
 * answered (an approval can be written before the redirect that follows it fails) and is a no-op for an
 * approval that kept or widened the scopes. It does nothing for a `skipConsent` client, whose tokens the
 * provider issues without consulting consent, nor without a consent row, which is a revoke that
 * ENG-2499's handlers own.
 *
 * A failure here is logged, not thrown: the approval is already committed, and failing the request
 * would only cost the client its code. The refresh check still refuses every token beyond the consent.
 */
export const revokeTokensBeyondConsentAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== CONSENT_PATH && ctx.path !== CONSENT_UPDATE_PATH) return;

  const ids: { userId?: string; clientId?: string } = {};
  try {
    const session = await getSessionFromCtx(ctx);
    if (!session) return;
    ids.userId = session.user.id;

    const clientId = await changedConsentClientId(ctx, ids.userId);
    if (!clientId) {
      // An approval the provider accepted always names its client. Silence here would mean the
      // provider's request state stopped reaching this hook, and narrowing waited for the next refresh.
      if (isAcceptedApproval(ctx)) {
        logger.warn(
          ids,
          "OAuth consent approved but its client couldn't be read; the refresh check still applies"
        );
      }
      return;
    }
    ids.clientId = clientId;

    const ended = await endTokensBeyondChangedConsent(ids.userId, clientId);
    if (!ended || ended.refreshTokensDeleted + ended.accessTokensRevoked === 0) return;

    logger.info({ ...ids, ...ended }, "OAuth consent narrowed; tokens beyond it ended");
  } catch (err) {
    logger.error(
      { err, ...ids },
      "OAuth consent changed but ending the tokens beyond it failed; the refresh check still applies"
    );
  }
};

const isAcceptedApproval = (ctx: AuthHookContext): boolean =>
  ctx.path === CONSENT_PATH &&
  (ctx.body as { accept?: unknown } | undefined)?.accept === true &&
  !isAPIError((ctx.context as { returned?: unknown }).returned);

/** The consent hook's transaction: settle the consent rows, then end the tokens beyond them. */
const endTokensBeyondChangedConsent = (userId: string, clientId: string) =>
  prisma.$transaction(async (tx) => {
    const client = await tx.oauthClient.findUnique({ where: { clientId }, select: { skipConsent: true } });
    if (!client || client.skipConsent) return null;
    const consentedScopes = await settleConsentedScopes(tx, userId, clientId);
    if (!consentedScopes) return null;
    return endTokensBeyondScopes(tx, { userId, clientId, consentedScopes });
  });

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
 * still has consent, and that the consent still covers every scope of the presented refresh token.
 *
 *  - No consent (ENG-2499): revokes every token the client holds for the user (the one just issued
 *    included) and replaces the response with `invalid_grant`, so the new tokens never leave.
 *  - A consent narrowed below the token (ENG-3529): ends the client's tokens that reach past the
 *    consent and the presented token's whole grant (the one just issued included, even when the client
 *    asked for scopes the consent does cover), and answers `invalid_grant`. The client has to go back
 *    through `/authorize`, which only issues what the consent covers. Grants within the consent, such
 *    as the narrowed approval's own, keep working.
 *
 * It runs after issuance on purpose. A check before issuance could pass, then lose to a revoke that
 * commits before the new refresh token is inserted, leaving that token outside the revoke's update.
 * After issuance, the new token already exists, and the consent is read `FOR SHARE`: either the read
 * waits on an in-flight revoke's delete (or narrowing's update) and sees its result, or it ran before
 * it. In the second case the revoke's own token update comes later and catches the new token.
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
        select: {
          userId: true,
          clientId: true,
          scopes: true,
          authorizationCodeId: true,
          rotatedAt: true,
          sessionId: true,
          client: { select: { skipConsent: true } },
        },
      })
    : null;
  if (!refreshToken) {
    logger.error("OAuth refresh succeeded but its refresh token could not be matched to a stored row");
    throw invalidGrant();
  }
  if (refreshToken.client.skipConsent) return;

  const { userId, clientId, scopes, authorizationCodeId, rotatedAt, sessionId } = refreshToken;
  const refused = await prisma.$transaction(async (tx) => {
    const consentedScopes = await readConsentedScopes(tx, userId, clientId);
    if (!consentedScopes) {
      return {
        reason: "consent_revoked",
        ...(await revokeClientTokens(tx, userId, clientId)),
      };
    }
    if (isCoveredBy(scopes, consentedScopes)) return null;
    return {
      reason: "consent_narrowed",
      ...(await endTokensBeyondScopes(tx, {
        userId,
        clientId,
        consentedScopes,
        grant: { authorizationCodeId, rotatedAt, sessionId },
      })),
    };
  });
  if (!refused) return;

  logger.warn({ userId, clientId, ...refused }, "OAuth refresh refused: its consent no longer covers it");
  throw invalidGrant();
};
