import "server-only";
import { Prisma } from "@formbricks/database/prisma";

/**
 * Ending the OAuth tokens a consent no longer covers (ENG-3529), shared by the consent hook
 * (`oauth-grant-revocation.ts`) and the refresh check (`oauth-refresh-check.ts`): which tokens reach past a
 * consent's scopes, and ending them a whole grant (chain of rotations) at a time.
 */

export type TTokensBeyondConsent = { refreshTokensDeleted: number; accessTokensRevoked: number };

/**
 * The refresh token a refresh presented, as its row records it: what finds its chain of rotations, so the
 * tokens minted for a refused request end too. Tokens from Better Auth 1.7 on carry an
 * `authorizationCodeId` shared by every rotation. Older ones have none, so the one refresh token minted for
 * the request is found by what rotation stamps on it: its `createdAt` is the presented token's `rotatedAt`
 * (both stamped from one clock reading during rotation), in the same session, within the presented token's
 * scopes (a refresh can only narrow).
 */
export type TPresentedRefreshToken = {
  authorizationCodeId: string | null;
  rotatedAt: Date | null;
  sessionId: string | null;
  scopes: string[];
};

/**
 * Ends the client's tokens for the user that reach past `consentedScopes`, and every other token of the
 * grants they belong to (one approval's chain of rotations, shared `authorizationCodeId`). A grant ends
 * whole: a refresh may have asked for fewer scopes, leaving a child inside the consent whose ancestor
 * isn't, and that child must not outlive the token it was minted from. The narrowed approval's own grant
 * has a new id, so it is untouched. When a refused refresh's `presentedToken` is given, its chain ends too.
 * Prisma's list filters can't express "not a subset of", hence the raw `<@`.
 *
 * Refresh tokens are deleted rather than marked revoked, rotated ones included. The provider reads a
 * revoked refresh token presented again as a stolen one and deletes every refresh token the client holds
 * for the user, so a client still holding a token from before the narrowing would take the narrowed
 * grant down with it. A deleted token is answered `invalid_grant` and nothing else. Access tokens have
 * no such reuse check, and are revoked like the rest of this module's, including those minted from a
 * refresh token about to be deleted. Those are then unlinked from it, so the `refreshId` cascade leaves
 * them behind as revoked rows, as ENG-2499's revoke does, instead of removing them.
 */
export const endTokensBeyondScopes = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    consentedScopes,
    presentedToken = { authorizationCodeId: null, rotatedAt: null, sessionId: null, scopes: [] },
  }: {
    userId: string;
    clientId: string;
    consentedScopes: string[];
    presentedToken?: TPresentedRefreshToken;
  }
): Promise<TTokensBeyondConsent> => {
  const { authorizationCodeId, rotatedAt, sessionId, scopes: presentedScopes } = presentedToken;
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
  // Without a presented token, `rotatedAt` is null and `"createdAt" = NULL` never matches.
  const ending = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "oauthRefreshToken"
    WHERE "userId" = ${userId} AND "clientId" = ${clientId}
      AND (NOT ("scopes" <@ ${consentedScopes}::text[])
        OR "authorizationCodeId" = ANY(${grantIds}::text[])
        OR (${authorizationCodeId}::text IS NULL AND "authorizationCodeId" IS NULL
          AND "createdAt" = ${rotatedAt} AND "sessionId" IS NOT DISTINCT FROM ${sessionId}
          AND "scopes" <@ ${presentedScopes}::text[]))
    ORDER BY "id"
    FOR UPDATE`;
  const refreshIds = ending.map((row) => row.id);
  const accessTokensRevoked = await tx.$executeRaw`
    UPDATE "oauthAccessToken" SET "revoked" = ${new Date()}
    WHERE "userId" = ${userId} AND "clientId" = ${clientId} AND "revoked" IS NULL
      AND (NOT ("scopes" <@ ${consentedScopes}::text[])
        OR "authorizationCodeId" = ANY(${grantIds}::text[])
        OR "refreshId" = ANY(${refreshIds}::text[]))`;
  await tx.$executeRaw`
    UPDATE "oauthAccessToken" SET "refreshId" = NULL
    WHERE "userId" = ${userId} AND "clientId" = ${clientId} AND "refreshId" = ANY(${refreshIds}::text[])`;
  const refreshTokensDeleted = await tx.$executeRaw`
    DELETE FROM "oauthRefreshToken" WHERE "id" = ANY(${refreshIds}::text[])`;
  return { refreshTokensDeleted, accessTokensRevoked };
};

export const isCoveredBy = (scopes: string[], consentedScopes: string[]): boolean =>
  scopes.every((scope) => consentedScopes.includes(scope));

/**
 * Whether any token of a grant, rotated ones included, reaches past the consent. A grant ends whole
 * (see {@link endTokensBeyondScopes}), so a token inside the consent still goes when a sibling or
 * ancestor doesn't fit: one narrowed before this fix, which no consent hook ever reconciled.
 */
export const grantReachesBeyond = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    grantId,
    consentedScopes,
  }: { userId: string; clientId: string; grantId: string; consentedScopes: string[] }
): Promise<boolean> => {
  const [{ beyond }] = await tx.$queryRaw<{ beyond: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "oauthRefreshToken"
      WHERE "userId" = ${userId} AND "clientId" = ${clientId} AND "authorizationCodeId" = ${grantId}
        AND NOT ("scopes" <@ ${consentedScopes}::text[])
      UNION ALL
      SELECT 1 FROM "oauthAccessToken"
      WHERE "userId" = ${userId} AND "clientId" = ${clientId} AND "authorizationCodeId" = ${grantId}
        AND "revoked" IS NULL AND NOT ("scopes" <@ ${consentedScopes}::text[])
    ) AS "beyond"`;
  return beyond;
};
