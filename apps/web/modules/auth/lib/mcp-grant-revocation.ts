import "server-only";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import {
  MCP_GRANT_SYSTEM_ACTOR,
  type TMcpGrantAuditRecord,
  prepareMcpGrantAudits,
  queueMcpGrantAudits,
} from "@/modules/mcp/grant-audit";
import {
  MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS,
  type TStoredMcpGrant,
  deleteMcpGrants,
  lockUserForMcpRevocation,
  removeDeletedMcpGrants,
} from "@/modules/mcp/grant-store";
import { lockConsents } from "./oauth-consent-rows";
import { markOAuthRevocation } from "./oauth-revocation-marker";

/**
 * Ending an MCP grant: Revoke on Authorized apps, and every bulk end of a user's OAuth access (a member
 * removal, the switch to Dashboard viewer, the retention sweep, SSO recovery).
 *
 * Split from `oauth-grant-revocation.ts`, which owns the hooks that follow a consent change. The two share
 * the consent row locks (`oauth-consent-rows.ts`) and take them in the same order: the user's row, then the
 * grants, then the consent rows.
 */

const CONSENT_DELETE_PATH = "/oauth2/delete-consent";

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
  // The user's pending sign-in codes live outside PostgreSQL: marked, so none issued before now is
  // exchanged. Before the commit, so no code can be exchanged between it and the mark.
  await markOAuthRevocation({ userId });
  // The user's row `FOR UPDATE`, the lock a grant writer takes `FOR KEY SHARE` (a `skipConsent` code
  // exchange): a grant it writes after this waits, then reads the mark this wrote and refuses, and one it
  // wrote before is deleted below. Idempotent for a caller that already holds the row.
  await lockUserForMcpRevocation(tx, userId);
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
 * sweep, SSO recovery). Call it once that transaction has committed: removing them before could leave a
 * grant whose delete rolls back reaching less than its rows say. Never throws.
 */
export const finishRevokedMcpGrants = async (
  records: ReadonlyArray<TMcpGrantAuditRecord>,
  { actorUserId }: { actorUserId?: string } = {}
): Promise<void> => {
  await removeDeletedMcpGrants(records.flatMap(({ before }) => (before ? [before] : [])));
  await queueMcpGrantAudits(
    actorUserId ? { userId: actorUserId, userType: "user" } : MCP_GRANT_SYSTEM_ACTOR,
    records
  );
};

/**
 * ENG-7364: a password reset is what a user does when they suspect the account was taken over, and
 * `revokeSessionsOnPasswordReset` ends sessions only. An OAuth client someone registered and authorized
 * while they had access would keep a 30-day refresh token and its MCP grant, so the reset ends every grant
 * too, as SSO recovery does, audited by the system. Best-effort like the rest of `onPasswordReset`: the
 * password is already changed, so a failure is logged and never fails the reset. API keys are left alone on
 * purpose, since revoking them breaks the user's integrations.
 */
export const revokeOAuthGrantsAfterPasswordReset = async (userId: string): Promise<void> => {
  try {
    // Its grant rows can be held by a reconciling pass: the Revoke timeout allows for that.
    const { grantAudits } = await prisma.$transaction((tx) => revokeAllUserOAuthGrants(tx, userId), {
      timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS,
    });
    await finishRevokedMcpGrants(grantAudits);
  } catch (error) {
    logger.error({ err: loggableError(error), userId }, "Failed to revoke OAuth grants after password reset");
  }
};

type TRevokedGrant = { consentsDeleted: number; refreshTokensRevoked: number; accessTokensRevoked: number };

/** What {@link revokeMcpClient} ended: the counts, the deleted grants, and their audit entries. */
type TRevokedClient = TRevokedGrant & {
  grants: TStoredMcpGrant[];
  /** Prepared in the revoking transaction: pass to `queueMcpGrantAudits` once it has committed. */
  grantAudits: TMcpGrantAuditRecord[];
};

/**
 * Ends the user's access for one MCP client (Revoke, on Authorized apps): its grant, its consent rows and
 * its tokens, in the caller's transaction. The grant is locked and deleted before the consent rows are
 * locked, the order every path that locks both takes. The audit entries are prepared here too, so they name
 * the organizations the grant reached when it ended, not after a membership change that follows.
 */
const endClientAccess = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<TRevokedClient> => {
  // Before the grant: the lock a code exchange's grant write takes `FOR KEY SHARE`, so one that marked
  // and then waits here is waited for, and one that wrote first is deleted below.
  await lockUserForMcpRevocation(tx, userId);
  const grants = await deleteMcpGrants(tx, { userId, clientId });
  await lockConsents(tx, userId, { clientId }, "update");
  const consents = await tx.oauthConsent.deleteMany({ where: { userId, clientId } });
  const tokens = await revokeClientTokens(tx, userId, clientId);
  const grantAudits = await prepareMcpGrantAudits(
    tx,
    grants.map((grant) => ({ action: "deleted" as const, before: grant, after: null }))
  );
  return { consentsDeleted: consents.count, grants, grantAudits, ...tokens };
};

export const revokeClientTokens = async (
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
}): Promise<TRevokedClient | null> => {
  // Its pending sign-in codes live outside PostgreSQL: marked first, so none issued before now is exchanged.
  await markOAuthRevocation({ userId, clientId });
  // Allows for a reconciling pass holding the grant row (MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS).
  const revoked = await prisma.$transaction((tx) => endClientAccess(tx, userId, clientId), {
    timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS,
  });
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
}): Promise<TRevokedClient | null> => {
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

  const { grants, grantAudits, ...counts } = revoked;
  await queueMcpGrantAudits({ userId: session.user.id, userType: "user" }, grantAudits);
  logger.info(
    { userId: session.user.id, consentId, ...counts, grantsDeleted: grants.length },
    "OAuth consent revoked with its grant and tokens"
  );
  return { success: true };
};
