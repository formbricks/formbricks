import "server-only";
import { defineRequestState } from "@better-auth/core/context";
import { getOAuthProviderState, verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { APIError, getSessionFromCtx, isAPIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { readMcpGrantReadableWorkspaceIds } from "@/modules/mcp/access-options";
import {
  type TRequestedMcpGrant,
  capMcpGrantPermissions,
  getMcpGrantPermissionsForScopes,
} from "@/modules/mcp/grant";
import {
  MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS,
  MCP_GRANT_SYSTEM_ACTOR,
  type TMcpGrantAuditRecord,
  type TStoredMcpGrant,
  deleteMcpGrants,
  getMcpGrant,
  hasMcpGrant,
  lockMcpGrant,
  narrowMcpGrantAccess,
  prepareMcpGrantAudits,
  projectMcpGrants,
  queueMcpGrantAudit,
  queueMcpGrantAudits,
  removeDeletedMcpGrants,
  shareLockMcpGrant,
  writeMcpGrant,
} from "@/modules/mcp/grant-store";
import { getApprovedMcpGrant } from "./mcp-grant-consent";
import {
  MCP_GRANT_NOT_SAVED_CODE,
  MCP_GRANT_NOT_SAVED_DETAIL,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
} from "./mcp-grant-consent-errors";
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
 *  - The refresh check refuses a refresh token when the consent no longer covers it or any other token
 *    of its grant, and ends the tokens beyond it, for the same race and for grants narrowed before this
 *    fix.
 *
 * Access tokens are self-contained JWTs verified against JWKS (`modules/mcp/auth.ts`), never looked up.
 * ENG-7149 closes the revoke residual that left: every MCP client a user authorized has a grant
 * (`McpGrant`, ADR-0041), revoking deletes it with the consent, and `/api/mcp` refuses a request whose
 * client has no grant, so a revoked client is refused on its next call. A narrowed consent still leaves a JWT minted before
 * it its old scopes for up to `accessTokenExpiresIn` (15 minutes); the grant, which Edit narrows instead
 * of the consent, has no such residual. The `oauthAccessToken` writes below only matter for opaque
 * tokens.
 *
 * ENG-7149: the grant is created by the consent hook on Allow, and the refresh check treats a client
 * without one like a revoked one, so a consent left without a grant (written by the previous release
 * during a rolling upgrade) ends at the next refresh and the client goes back through the consent screen,
 * where Allow writes it. An Allow whose grant can't be saved puts the consent back as it was, so it
 * leaves no such consent behind.
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
 * write is therefore defence for the opaque-token configuration only. The JWTs are ended by the grants
 * deleted below instead (ENG-7149): `/api/mcp` refuses a client without one on its next call.
 *
 * Consent goes too: `/authorize` skips the consent screen when a matching `oauthConsent` row exists, so
 * leaving it would let a still-cookie-cached session (see session-revocation.ts) silently mint a fresh
 * 30-day refresh token and undo the revocation. The user's MCP grants go with it (ENG-7149), which is what
 * refuses their clients' access tokens on the next call: no SpiceDB call is needed for that, so none is
 * made here. Each deleted grant is returned ready to audit: the caller passes them to
 * {@link finishRevokedMcpGrants} once its transaction commits, which removes their SpiceDB relationships
 * and queues the entries, so a rolled-back revocation records nothing.
 */
export const revokeAllUserOAuthGrants = async (
  tx: Prisma.TransactionClient,
  userId: string,
  revokedAt: Date = new Date()
): Promise<{
  accessTokensRevoked: number;
  refreshTokensRevoked: number;
  consentsDeleted: number;
  grantsDeleted: number;
  /** One per deleted grant: pass to `finishRevokedMcpGrants` once the caller's transaction commits. */
  grantAudits: TMcpGrantAuditRecord[];
}> => {
  // Grants first, then consents, the order every path that locks both takes, so a concurrent save waits
  // rather than deadlocks. Each kind is locked in id order before its delete. The tokens are revoked last:
  // a refresh that passed its consent check before the consents were locked has inserted its token by
  // the time the update below runs, so the update catches it.
  const grants = await deleteMcpGrants(tx, { userId });
  await tx.$queryRaw`SELECT "id" FROM "oauthConsent" WHERE "userId" = ${userId} ORDER BY "id" FOR UPDATE`;
  const consentRows = await tx.oauthConsent.deleteMany({ where: { userId } });
  // Read in the transaction, so the entries name the organizations as they stood when the grants ended.
  const grantAudits = await prepareMcpGrantAudits(
    tx,
    grants.map((grant) => ({ action: "deleted" as const, before: grant, after: null }))
  );
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
    grantsDeleted: grants.length,
    grantAudits,
  };
};

/**
 * What follows the commit of a transaction that ended grants ({@link revokeAllUserOAuthGrants}): removes
 * their SpiceDB relationships, best-effort, and audits them. They end as a consequence of something else
 * (a role lost, an account switched off or recovered), so the entries name who did that: `actorUserId`,
 * the user who removed the member or changed the role, or the system when no user did (the retention
 * sweep, SSO recovery). Call it once that transaction has committed. Never throws.
 *
 * `removeRelationships: false` for a caller that can only call it before the commit (a role change inside
 * its caller's transaction): removing them then could leave a grant whose delete rolls back reaching less
 * than its rows say, and the outbox event the delete queues removes them once it commits.
 */
export const finishRevokedMcpGrants = async (
  records: ReadonlyArray<TMcpGrantAuditRecord>,
  { removeRelationships = true, actorUserId }: { removeRelationships?: boolean; actorUserId?: string } = {}
): Promise<void> => {
  if (removeRelationships) {
    await removeDeletedMcpGrants(records.flatMap(({ before }) => (before ? [before] : [])));
  }
  await queueMcpGrantAudits(
    actorUserId ? { userId: actorUserId, userType: "user" } : MCP_GRANT_SYSTEM_ACTOR,
    records
  );
};

const CONSENT_PATH = "/oauth2/consent";
const CONSENT_UPDATE_PATH = "/oauth2/update-consent";
const CONSENT_DELETE_PATH = "/oauth2/delete-consent";
const TOKEN_PATH = "/oauth2/token";

type TRevokedGrant = { consentsDeleted: number; refreshTokensRevoked: number; accessTokensRevoked: number };

/**
 * Ends the user's access for one MCP client (Revoke, on Authorized apps): its grant, its consent rows and
 * its tokens, in the caller's transaction. The grant is locked and deleted before the consent rows are
 * locked, the order every path that locks both takes.
 */
const endClientAccess = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<TRevokedGrant & { grants: TStoredMcpGrant[] }> => {
  const grants = await deleteMcpGrants(tx, { userId, clientId });
  await lockConsents(tx, userId, { clientId }, "update");
  const consents = await tx.oauthConsent.deleteMany({ where: { userId, clientId } });
  const tokens = await revokeClientTokens(tx, userId, clientId);
  return { consentsDeleted: consents.count, grants, ...tokens };
};

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

type TConsentRow = {
  id: string;
  clientId: string;
  scopes: string[];
  updatedAt: Date;
  skipConsent: boolean;
};

/**
 * Which client's consent to read: by client id, or, for `update-consent`, through the id of one of its
 * consent rows, which only resolves when that row is the user's.
 */
type TConsentTarget = { clientId: string } | { consentId: string };

/**
 * Locks the user's consent rows for the client, in `id` order, with the client's `skipConsent` flag. One
 * round trip for everything the hooks read before deciding. Every path that locks several rows (this
 * module's; upstream writes only one row at a time) takes them in that order, and after the client's
 * grant, so a refresh racing a revoke or a narrowing waits instead of deadlocking.
 */
const lockConsents = (
  tx: Prisma.TransactionClient,
  userId: string,
  target: TConsentTarget,
  mode: "share" | "update"
): Promise<TConsentRow[]> => {
  const clientId =
    "clientId" in target
      ? Prisma.sql`${target.clientId}`
      : Prisma.sql`(
          SELECT "clientId" FROM "oauthConsent" WHERE "id" = ${target.consentId} AND "userId" = ${userId}
        )`;
  const lock = mode === "update" ? Prisma.sql`FOR UPDATE OF c` : Prisma.sql`FOR SHARE OF c`;
  return tx.$queryRaw<TConsentRow[]>`
    SELECT c."id", c."clientId", c."scopes", c."updatedAt", cl."skipConsent"
    FROM "oauthConsent" c JOIN "oauthClient" cl ON cl."clientId" = c."clientId"
    WHERE c."userId" = ${userId} AND c."clientId" = ${clientId}
    ORDER BY c."id"
    ${lock}`;
};

/**
 * The scopes a set of consent rows allows, and the row that decision rests on; `null` without a row.
 *
 * Normally one row: the provider finds the (user, client) consent and updates it. Two concurrent first
 * approvals can each insert one, though, and a later approval or `update-consent` then rewrites only one
 * of them. The bound is the most recently written row, the user's latest decision. Picked here rather
 * than by `ORDER BY`, which sorts before a waited-on row's new values come back.
 *
 * The provider stamps `updatedAt` to the second, so rows written in the same second can't be ordered by
 * it. `isLatestWrite` then names the row the caller knows was just written; without one, the bound is
 * what every tied row allows, which can only ever be narrower than the user meant.
 */
const consentBound = (
  consents: TConsentRow[],
  isLatestWrite?: (consent: TConsentRow) => boolean
): { scopes: string[]; newest: TConsentRow } | null => {
  if (consents.length === 0) return null;
  const newestAt = Math.max(...consents.map((consent) => consent.updatedAt.getTime()));
  const newest = consents.filter((consent) => consent.updatedAt.getTime() === newestAt);
  const written = isLatestWrite ? newest.find(isLatestWrite) : undefined;
  if (written) return { scopes: written.scopes, newest: written };
  const scopes = newest[0].scopes.filter((scope) =>
    newest.every((consent) => consent.scopes.includes(scope))
  );
  return { scopes, newest: newest[0] };
};

/**
 * The scopes the user has consented to for the client, or `null` without a consent. Read `FOR SHARE`,
 * so a consent delete or narrowing that is still in flight is waited on rather than read around.
 */
export const readConsentedScopes = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<string[] | null> =>
  consentBound(await lockConsents(tx, userId, { clientId }, "share"))?.scopes ?? null;

/**
 * The consent hook's read: the client and its bound, folding duplicate rows into the one the bound rests
 * on. The provider's `/authorize` looks a consent up with an unordered `findOne`, so a stale wider
 * duplicate would otherwise keep skipping the consent screen and minting wide codes after the user
 * narrowed the other row. `null` for a `skipConsent` client, whose tokens the provider issues without
 * consulting consent, or without a consent row.
 */
const settleConsent = async (
  tx: Prisma.TransactionClient,
  userId: string,
  change: TConsentChange
): Promise<{ clientId: string; scopes: string[] } | null> => {
  const consents = await lockConsents(tx, userId, change.target, "update");
  if (consents.length === 0 || consents[0].skipConsent) return null;
  const { clientId } = consents[0];
  const bound = consentBound(consents, change.isLatestWrite);
  if (!bound) return null;
  if (consents.length > 1) {
    await tx.oauthConsent.deleteMany({ where: { userId, clientId, id: { not: bound.newest.id } } });
    if (bound.scopes.length !== bound.newest.scopes.length) {
      await tx.oauthConsent.update({ where: { id: bound.newest.id }, data: { scopes: bound.scopes } });
    }
  }
  return { clientId, scopes: bound.scopes };
};

type TTokensBeyondConsent = { refreshTokensDeleted: number; accessTokensRevoked: number };

/**
 * The grant a refused refresh belongs to, so the tokens minted for that request end too. Grants from
 * Better Auth 1.7 on carry an `authorizationCodeId` shared by every rotation. Older ones have none, so the
 * one refresh token minted for the request is found by what rotation stamps on it: its `createdAt` is
 * the presented token's `rotatedAt` (both stamped from one clock reading during rotation), in the same
 * session, within the presented token's scopes (a refresh can only narrow).
 */
type TRefusedGrant = {
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
 * has a new id, so it is untouched. When a refused refresh's `grant` is given, that grant ends too.
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
const endTokensBeyondScopes = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    consentedScopes,
    grant = { authorizationCodeId: null, rotatedAt: null, sessionId: null, scopes: [] },
  }: { userId: string; clientId: string; consentedScopes: string[]; grant?: TRefusedGrant }
): Promise<TTokensBeyondConsent> => {
  const { authorizationCodeId, rotatedAt, sessionId, scopes: presentedScopes } = grant;
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

const isCoveredBy = (scopes: string[], consentedScopes: string[]): boolean =>
  scopes.every((scope) => consentedScopes.includes(scope));

/**
 * Whether any token of a grant, rotated ones included, reaches past the consent. A grant ends whole
 * (see {@link endTokensBeyondScopes}), so a token inside the consent still goes when a sibling or
 * ancestor doesn't fit: one narrowed before this fix, which no consent hook ever reconciled.
 */
const grantReachesBeyond = async (
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

/**
 * Revokes the user's MCP client (Authorized apps' Revoke, spec stories 29 and 38): deletes its grant and
 * its consent rows and revokes every token the client holds for the user, in one transaction. Returns
 * `null` when the user has neither a grant nor a consent for the client, so another user's client can't be
 * told apart from none. Works for a `skipConsent` client too, which holds a grant and no consent.
 *
 * Its current access token is a JWT that can't be revoked, but `/api/mcp` refuses a request whose user and
 * client have no grant, so the client's next call answers 401. Once the transaction has committed, the
 * grant's SpiceDB relationships are removed, best-effort: nothing depends on them any more.
 *
 * The consent rows are deleted BEFORE the tokens are revoked, and the order is load-bearing: the delete
 * takes the row locks that {@link requireOAuthConsentOnRefreshAfterHandler}'s `FOR SHARE` read waits on.
 * A refresh that rotates in the gap between the token update and the commit therefore can't read the
 * consent as still present.
 */
export const revokeMcpClient = async ({
  userId,
  clientId,
}: {
  userId: string;
  clientId: string;
}): Promise<(TRevokedGrant & { grants: TStoredMcpGrant[] }) | null> => {
  const revoked = await prisma.$transaction((tx) => endClientAccess(tx, userId, clientId));
  if (revoked.grants.length === 0 && revoked.consentsDeleted === 0) return null;
  await removeDeletedMcpGrants(revoked.grants);
  return revoked;
};

/**
 * {@link revokeMcpClient} for the client of one of the user's consent rows, which is how the provider's
 * `delete-consent` endpoint names it. Returns `null` when the consent doesn't exist or belongs to someone
 * else — one answer for both, so the id can't be probed.
 *
 * Scoped to the client rather than the single consent row: Authorized Apps lists and revokes apps, and a
 * leftover consent for the same client would let `/authorize` skip the consent screen.
 */
export const revokeOAuthConsentGrant = async ({
  userId,
  consentId,
}: {
  userId: string;
  consentId: string;
}): Promise<(TRevokedGrant & { grants: TStoredMcpGrant[] }) | null> => {
  const consent = await prisma.oauthConsent.findFirst({
    where: { id: consentId, userId },
    select: { clientId: true },
  });
  return consent ? revokeMcpClient({ userId, clientId: consent.clientId }) : null;
};

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

  const { grants, ...counts } = revoked;
  for (const grant of grants) {
    await queueMcpGrantAudit({ action: "deleted", actorUserId: session.user.id, before: grant, after: null });
  }
  logger.info(
    { userId: session.user.id, consentId, ...counts, grantsDeleted: grants.length },
    "OAuth consent revoked with its grant and tokens"
  );
  return { success: true };
};

/**
 * What a consent request changed, read from the request alone; `null` for any other request. For
 * `/oauth2/consent`, the client comes from the provider's own request state, the verified authorization
 * query the endpoint itself read the client from. `isLatestWrite` names the row the request wrote, for
 * {@link consentBound}'s same-second tie.
 */
type TConsentChange = {
  /**
   * Allow on the consent screen that the provider accepted, which saves the client's grant at the levels
   * the approved scopes give (ENG-7149). `update-consent` edits the consent alone: ADR-0041 keeps the
   * grant out of it, and the token check bounds the consent's scopes anyway.
   */
  savesGrant: boolean;
  /**
   * The client's consent rows as they were before the provider wrote this approval
   * ({@link snapshotConsentBeforeApprovalHandler}), to put back if its grant can't be saved; `null` when no
   * snapshot names this user and client, and for `update-consent`.
   */
  previousConsents: TConsentSnapshotRow[] | null;
  /**
   * The grant the user chose on the consent screen: the levels of its matrix (ENG-7150), saved capped by
   * the consent's scopes, and its organization & workspace access (ENG-7153). `null` saves what the
   * scopes give, keeping the access an existing grant has.
   */
  chosenGrant: TRequestedMcpGrant | null;
  target: TConsentTarget;
  isLatestWrite: (consent: TConsentRow) => boolean;
};

const isApproval = (ctx: AuthHookContext): boolean =>
  ctx.path === CONSENT_PATH && (ctx.body as { accept?: unknown } | undefined)?.accept === true;

const isAcceptedApproval = (ctx: AuthHookContext): boolean =>
  isApproval(ctx) && !isAPIError((ctx.context as { returned?: unknown }).returned);

const sameScopes = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((scope) => b.includes(scope));

const consentChange = async (ctx: AuthHookContext, userId: string): Promise<TConsentChange | null> => {
  // A row is this request's write only if the provider accepted the request and the row was stamped in
  // this request's second (the provider stamps to the second, just before this hook runs). Some
  // accepted paths write nothing, such as a `prompt=login` bounce, so acceptance alone isn't enough: a
  // tie left over from earlier must fall back to what every tied row allows.
  const accepted = !isAPIError((ctx.context as { returned?: unknown }).returned);
  const thisSecond = Math.floor(Date.now() / 1000) * 1000 - 1000;
  const wrote = (consent: TConsentRow) => accepted && consent.updatedAt.getTime() >= thisSecond;
  if (isApproval(ctx)) {
    const query = new URLSearchParams((await getOAuthProviderState())?.query ?? "");
    const clientId = query.get("client_id");
    if (!clientId) return null;
    // The provider stores the scopes the user accepted, or every scope the request asked for.
    const bodyScope = (ctx.body as { scope?: unknown }).scope;
    const approved = (typeof bodyScope === "string" ? bodyScope : query.get("scope"))?.split(" ") ?? [];
    const snapshot = await consentSnapshot.get();
    return {
      savesGrant: accepted,
      previousConsents: snapshot?.userId === userId && snapshot.clientId === clientId ? snapshot.rows : null,
      chosenGrant: getApprovedMcpGrant(ctx),
      target: { clientId },
      isLatestWrite: (consent) => wrote(consent) && sameScopes(consent.scopes, approved),
    };
  }
  if (ctx.path === CONSENT_UPDATE_PATH) {
    const consentId = (ctx.body as { id?: unknown } | undefined)?.id;
    if (typeof consentId !== "string") return null;
    return {
      savesGrant: false,
      previousConsents: null,
      chosenGrant: null,
      target: { consentId },
      isLatestWrite: (consent) => wrote(consent) && consent.id === consentId,
    };
  }
  return null;
};

/**
 * `hooks.after` for `POST /oauth2/consent` and `POST /oauth2/update-consent`. Once the provider has
 * written the consent, saves the grant an approval gives, and ends the client's tokens for the user that
 * reach past the consent, so a narrowed approval takes effect now rather than at each token's next refresh.
 *
 * The grant an approval saves (ENG-7149/7150/7153): the levels the user chose in the consent screen's
 * matrix, capped by the consent's scopes, or the levels the scopes give when the approval chose none; and
 * the organization & workspace access the user chose, by the rule Edit applies
 * (`resolveMcpGrantSelection`), or, when it chose none, the access an existing grant has (All access for
 * a new one). Audited as created or updated.
 *
 * It reconciles against the stored consent rather than the request, so it runs whatever the provider
 * answered (an approval can be written before the redirect that follows it fails) and is a no-op for an
 * approval that kept or widened the scopes. It does nothing for a `skipConsent` client, whose tokens the
 * provider issues without consulting consent, nor without a consent row, which is a revoke that
 * ENG-2499's handlers own.
 *
 * An approval whose grant can't be saved fails, and changes nothing: one that picks an organization or
 * workspace the user can't select answers 422, and one whose narrowing can't be applied to SpiceDB (or
 * whose transaction fails twice) answers 500. The consent screen shows the error, the grant stays as it
 * was, as Edit does, and so does the consent the provider already wrote ({@link restoreConsents}); the
 * client gets no code. A failure of `update-consent`, which saves no grant, is logged instead: the consent
 * is already written, and the refresh check still refuses every token beyond it.
 */
export const revokeTokensBeyondConsentAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== CONSENT_PATH && ctx.path !== CONSENT_UPDATE_PATH) return;

  const session = await getSessionFromCtx(ctx);
  if (!session) return;
  const userId = session.user.id;
  const ids: { userId: string; clientId?: string } = { userId };

  const change = await consentChange(ctx, userId);
  if (!change) {
    // An approval the provider accepted always names its client. Silence here would mean the provider's
    // request state stopped reaching this hook, and narrowing waited for the next refresh.
    if (isAcceptedApproval(ctx)) {
      logger.warn(
        ids,
        "OAuth consent approved but its client couldn't be read; the refresh check still applies"
      );
    }
    return;
  }

  const ended = await settleChangedConsentWithRetry(userId, change, ids);
  if (!ended) return;
  if (ended.status === "selection_unavailable") {
    // Its transaction already put the consent back, when a snapshot named it.
    if (!change.previousConsents) warnConsentNotRestored(ids);
    const kind = ended.field === "organizationIds" ? "organizations" : "workspaces";
    throw new APIError("UNPROCESSABLE_ENTITY", {
      error: "invalid_request",
      error_description: `Pick only ${kind} you have access to.`,
      code: MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
    });
  }

  ids.clientId = ended.clientId;
  const { savedGrant, refreshTokensDeleted, accessTokensRevoked } = ended;
  if (savedGrant) {
    // The access Allow chose applies on the client's first call, not when the outbox delivers (ENG-7153).
    await projectMcpGrants([savedGrant.after.id]);
    await queueMcpGrantAudit({
      action: savedGrant.before ? "updated" : "created",
      actorUserId: userId,
      before: savedGrant.before,
      after: savedGrant.after,
    });
  }
  if (refreshTokensDeleted + accessTokensRevoked === 0) return;
  logger.info(
    { ...ids, refreshTokensDeleted, accessTokensRevoked },
    "OAuth consent narrowed; tokens beyond it ended"
  );
};

/**
 * Runs {@link settleChangedConsent}, once more after a failure: a transient one (a transaction timeout, a
 * dropped connection, a SpiceDB blip) shouldn't cost the user their approval, and opaque access tokens
 * beyond the consent have no check of their own until the grant's next refresh. The first failure is
 * still logged, so a recurring one doesn't hide behind a retry that succeeds. A second failure fails an
 * approval (see the handler) and is logged for `update-consent`.
 */
const settleChangedConsentWithRetry = async (
  userId: string,
  change: TConsentChange,
  ids: { userId: string; clientId?: string }
): Promise<TSettledConsent | null> => {
  const settle = () => settleChangedConsent(userId, change);
  try {
    return await settle().catch(async (error: unknown) => {
      logger.warn(
        { err: loggableError(error), ...ids },
        "OAuth consent changed but settling it failed; retrying"
      );
      await restoreMcpGrantRelationships(userId, change);
      return settle();
    });
  } catch (error) {
    await restoreMcpGrantRelationships(userId, change);
    if (!change.savesGrant) {
      logger.error(
        { err: loggableError(error), ...ids },
        "OAuth consent changed but ending the tokens beyond it failed; the refresh check still applies"
      );
      return null;
    }
    logger.error(
      { err: loggableError(error), ...ids },
      "OAuth consent approved but its grant couldn't be saved"
    );
    await restoreConsentAfterFailedApproval(userId, change, ids);
    throw new APIError("INTERNAL_SERVER_ERROR", {
      error: "server_error",
      error_description: MCP_GRANT_NOT_SAVED_DETAIL,
      code: MCP_GRANT_NOT_SAVED_CODE,
    });
  }
};

/**
 * After a failed approval: a narrowing may have deleted relationships in SpiceDB before its transaction
 * rolled back, leaving the grant reaching less than its rows say. Reconciles the grant from its committed
 * rows, best-effort. Never throws.
 */
const restoreMcpGrantRelationships = async (userId: string, change: TConsentChange): Promise<void> => {
  if (!change.chosenGrant?.access || !("clientId" in change.target)) return;
  try {
    const grant = await getMcpGrant(userId, change.target.clientId);
    if (grant) await projectMcpGrants([grant.id]);
  } catch (error) {
    logger.warn(
      { err: loggableError(error), userId },
      "Reconciling an MCP grant after a failed approval failed"
    );
  }
};

/** A consent row as the provider writes it on Allow: every column its write sets, to put back. */
type TConsentSnapshotRow = {
  id: string;
  scopes: string[];
  resources: string[];
  requestedUserInfoClaims: string[];
  updatedAt: Date;
};

const CONSENT_SNAPSHOT_SELECT = {
  id: true,
  scopes: true,
  resources: true,
  requestedUserInfoClaims: true,
  updatedAt: true,
} as const;

/** The consent rows an approval found before the provider wrote it, kept for this request only. */
const consentSnapshot = defineRequestState<{
  userId: string;
  clientId: string;
  rows: TConsentSnapshotRow[];
} | null>(() => null);

/**
 * `hooks.before` for `POST /oauth2/consent`: reads the client's consent rows of an Allow before the provider
 * writes the consent, so an approval whose grant can't be saved can put them back.
 *
 * Better Auth's consent endpoint writes the consent through its adapter, outside any transaction this
 * module could join (our Prisma adapter runs without them), and before the after-hook saves the grant. So
 * a failed save can't roll that write back; the after-hook undoes it instead, from this snapshot
 * ({@link restoreConsents}). The client is the one the signed authorization query names, verified here as
 * the provider does: the provider's own request state is only set by its hook, which runs after this one.
 */
export const snapshotConsentBeforeApprovalHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (!isApproval(ctx)) return;
  const oauthQuery = (ctx.body as { oauth_query?: unknown }).oauth_query;
  if (typeof oauthQuery !== "string") return;
  // An unsigned or tampered query is refused by the provider's hook next; it saves nothing to put back.
  if (!(await verifyOAuthQueryParams(oauthQuery, ctx.context.secret))) return;
  const clientId = new URLSearchParams(oauthQuery).get("client_id");
  if (!clientId) return;
  const session = await getSessionFromCtx(ctx);
  if (!session) return;
  const userId = session.user.id;
  const rows = await prisma.oauthConsent.findMany({
    where: { userId, clientId },
    select: CONSENT_SNAPSHOT_SELECT,
  });
  await consentSnapshot.set({ userId, clientId, rows });
};

/**
 * Puts the client's consent rows back as the snapshot read them, in the caller's transaction, which already
 * holds the client's grant lock: deletes a row the approval created (none in the snapshot) and writes the
 * snapshot's values back to the rows it holds. A row deleted since the snapshot (a revoke) stays deleted.
 *
 * Compensation, not a rollback: a row another approval of the same client created between the snapshot and
 * here (two first approvals at once) is deleted too. That client then has a grant and no consent, which
 * the refresh check ends at its next refresh, and the consent screen shows again.
 */
const restoreConsents = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string,
  previous: ReadonlyArray<TConsentSnapshotRow>
): Promise<void> => {
  const current = await lockConsents(tx, userId, { clientId }, "update");
  const previousById = new Map(previous.map((row) => [row.id, row]));
  const created = current.filter(({ id }) => !previousById.has(id)).map(({ id }) => id);
  if (created.length > 0) {
    await tx.oauthConsent.deleteMany({ where: { userId, clientId, id: { in: created } } });
  }
  for (const { id } of current) {
    const row = previousById.get(id);
    if (!row) continue;
    const { id: _id, ...values } = row;
    await tx.oauthConsent.update({ where: { id }, data: values });
  }
};

const warnConsentNotRestored = (ids: { userId: string; clientId?: string }): void => {
  logger.warn(
    ids,
    "OAuth approval failed but no snapshot of its consent was read; the consent stays as written"
  );
};

/**
 * After an approval answered 500: its transactions rolled back, but the consent the provider wrote before
 * them did not. Puts it back from the snapshot, in a transaction of its own that takes the grant's lock
 * before the consent rows, as every path does. Best-effort and never throws: the approval already failed,
 * and a consent left behind only skips the consent screen until the refresh check ends it.
 */
const restoreConsentAfterFailedApproval = async (
  userId: string,
  change: TConsentChange,
  ids: { userId: string; clientId?: string }
): Promise<void> => {
  const previous = change.previousConsents;
  if (!("clientId" in change.target)) return;
  if (!previous) {
    warnConsentNotRestored(ids);
    return;
  }
  const { clientId } = change.target;
  try {
    await prisma.$transaction(async (tx) => {
      await shareLockMcpGrant(tx, { userId, clientId });
      await restoreConsents(tx, userId, clientId, previous);
    });
  } catch (error) {
    logger.error(
      { err: loggableError(error), userId, clientId },
      "OAuth approval failed and restoring its consent failed too"
    );
  }
};

/**
 * An approval's selection the user can't make: puts the consent back from the snapshot, in the grant's
 * transaction, which already holds the grant's lock, so the 422 changes nothing.
 */
const refuseSelection = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    change,
    field,
  }: { userId: string; clientId: string; change: TConsentChange; field: "organizationIds" | "workspaceIds" }
): Promise<TSettledConsent> => {
  if (change.previousConsents) await restoreConsents(tx, userId, clientId, change.previousConsents);
  return { status: "selection_unavailable", field };
};

type TSettledConsent =
  | { status: "selection_unavailable"; field: "organizationIds" | "workspaceIds" }
  | ({
      status: "settled";
      clientId: string;
      savedGrant: { before: TStoredMcpGrant | null; after: TStoredMcpGrant } | null;
    } & TTokensBeyondConsent);

/**
 * The consent hook's transaction. The workspaces SpiceDB lets the user select are looked up first, before
 * the transaction takes any lock. For an approval, the grant comes first: its row is locked `FOR UPDATE`,
 * the chosen access is resolved, and what a narrowing takes away is deleted from SpiceDB, all before any
 * consent row is locked, so no SpiceDB call runs while the consent rows are held. A selection the user
 * can't make puts the consent back from the snapshot in this transaction, and changes nothing else. Then
 * the consent rows are settled, the grant written while they are locked (a revoke or a refresh check
 * racing the approval sees both or neither), and the tokens beyond the consent ended. `null` when there is
 * nothing to settle: a `skipConsent` client, or no consent row.
 */
const settleChangedConsent = async (
  userId: string,
  change: TConsentChange
): Promise<TSettledConsent | null> => {
  const readableWorkspaceIds = await readMcpGrantReadableWorkspaceIds(userId, change.chosenGrant?.access);
  return prisma.$transaction(
    async (tx): Promise<TSettledConsent | null> => {
      const grantClientId = change.savesGrant && "clientId" in change.target ? change.target.clientId : null;
      let before: TStoredMcpGrant | null = null;
      let access = change.chosenGrant?.access;
      if (grantClientId) {
        const client = await tx.oauthClient.findUnique({
          where: { clientId: grantClientId },
          select: { skipConsent: true },
        });
        if (!client || client.skipConsent) return null;
        before = await lockMcpGrant(tx, { userId, clientId: grantClientId });
        if (access) {
          const resolved = await narrowMcpGrantAccess(tx, { userId, before, access, readableWorkspaceIds });
          if (resolved.status === "unavailable") {
            return refuseSelection(tx, { userId, clientId: grantClientId, change, field: resolved.field });
          }
          access = resolved.access;
        }
      }

      const consent = await settleConsent(tx, userId, change);
      if (!consent) return null;
      const { clientId, scopes: consentedScopes } = consent;
      const cap = getMcpGrantPermissionsForScopes(consentedScopes);
      const savedGrant = grantClientId
        ? await writeMcpGrant(tx, {
            userId,
            clientId,
            before,
            permissions: change.chosenGrant
              ? capMcpGrantPermissions(change.chosenGrant.permissions, cap)
              : cap,
            access,
          })
        : null;
      return {
        status: "settled",
        clientId,
        savedGrant,
        ...(await endTokensBeyondScopes(tx, { userId, clientId, consentedScopes })),
      };
    },
    { timeout: MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS }
  );
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
 *
 * It runs after issuance on purpose. A check before issuance could pass, then lose to a revoke that
 * commits before the new refresh token is inserted, leaving that token outside the revoke's update.
 * After issuance, the new token already exists, and the consent is read `FOR SHARE`: either the read
 * waits on an in-flight revoke's delete (or narrowing's update) and sees its result, or it ran before
 * it. In the second case the revoke's own token update comes later and catches the new token. The grant
 * is locked `FOR SHARE` before any consent row, the order every path that locks both takes.
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
    // Either a narrowing or revoke ended the token while this refresh was in flight, or the provider's
    // storage format has drifted (the integration suite catches the latter). Fail closed either way.
    logger.warn("OAuth refresh token no longer stored: ended concurrently, or the storage format drifted");
    throw invalidGrant();
  }
  if (refreshToken.client.skipConsent) return;

  const { userId, clientId, scopes, authorizationCodeId, rotatedAt, sessionId } = refreshToken;
  const refused = await prisma.$transaction(async (tx) => {
    // The grant first, then the consent rows. `FOR SHARE`: refreshes don't wait on each other, and a
    // revoke or a save, which lock it `FOR UPDATE`, wait on this check or it on them.
    if (!(await shareLockMcpGrant(tx, { userId, clientId }))) {
      // Locked, then read again: an approval saves the grant while holding these rows, so a grant it
      // commits while this waits is seen here rather than its client ended.
      const consents = await lockConsents(tx, userId, { clientId }, "update");
      if (consents.length > 0 && !(await hasMcpGrant(tx, { userId, clientId }))) {
        // No grant to delete: there is none, and none can be written while these rows are held.
        const deleted = await tx.oauthConsent.deleteMany({ where: { userId, clientId } });
        return {
          reason: "grant_missing",
          consentsDeleted: deleted.count,
          ...(await revokeClientTokens(tx, userId, clientId)),
        };
      }
    }
    const consentedScopes = await readConsentedScopes(tx, userId, clientId);
    if (!consentedScopes) {
      return {
        reason: "consent_revoked",
        ...(await revokeClientTokens(tx, userId, clientId)),
      };
    }
    const covered =
      isCoveredBy(scopes, consentedScopes) &&
      !(
        authorizationCodeId &&
        (await grantReachesBeyond(tx, { userId, clientId, grantId: authorizationCodeId, consentedScopes }))
      );
    if (covered) return null;
    return {
      reason: "consent_narrowed",
      ...(await endTokensBeyondScopes(tx, {
        userId,
        clientId,
        consentedScopes,
        grant: { authorizationCodeId, rotatedAt, sessionId, scopes },
      })),
    };
  });
  if (!refused) return;

  logger.warn(
    { userId, clientId, ...refused },
    "OAuth refresh refused: its consent or grant no longer covers it"
  );
  throw invalidGrant();
};
