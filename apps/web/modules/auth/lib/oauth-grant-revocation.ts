import "server-only";
import { defineRequestState } from "@better-auth/core/context";
import { getOAuthProviderState, verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { APIError, getSessionFromCtx, isAPIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS } from "@/lib/authzed/mcp-grant-timeouts";
import { loggableError } from "@/lib/utils/loggable-error";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { readMcpGrantReadableWorkspaceIds } from "@/modules/mcp/access-options";
import {
  type TMcpGrantAccessSelection,
  type TMcpGrantPermissions,
  type TRequestedMcpGrant,
  capMcpGrantPermissions,
  getMcpGrantPermissionsForScopes,
  isMcpGrantEmpty,
} from "@/modules/mcp/grant";
import {
  MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS,
  type TStoredMcpGrant,
  applyMcpGrantNarrowing,
  deleteMcpGrants,
  getMcpGrant,
  hasMcpGrant,
  lockMcpGrant,
  lockUserForMcpGrantWrite,
  projectMcpGrants,
  queueMcpGrantAudit,
  queueMcpGrantDeletionsAudit,
  removeDeletedMcpGrants,
  resolveMcpGrantNarrowing,
  shareLockMcpGrant,
  writeMcpGrant,
} from "@/modules/mcp/grant-store";
import { getApprovedMcpGrant } from "./mcp-grant-consent";
import {
  MCP_GRANT_BEYOND_SCOPES_CODE,
  MCP_GRANT_BEYOND_SCOPES_DETAIL,
  MCP_GRANT_NOT_SAVED_CODE,
  MCP_GRANT_NOT_SAVED_DETAIL,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
} from "./mcp-grant-consent-errors";
import { revokeClientTokens } from "./mcp-grant-revocation";
import { MCP_OAUTH_REFRESH_TOKEN_PREFIX } from "./mcp-oauth-provider-options";
import {
  type TConsentRow,
  type TConsentTarget,
  consentBound,
  lockConsents,
  readConsentedScopes,
} from "./oauth-consent-rows";
import {
  type TConsentPreimage,
  readConsentPreimages,
  readOwnConsentWriteCheck,
} from "./oauth-consent-writes";
import { isIssuedBeforeRevocation, readOAuthRevocationTime } from "./oauth-revocation-marker";

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
 *
 * This module holds the hooks that follow a consent change. Ending a grant — Revoke, and every bulk end of
 * a user's OAuth access — lives in `mcp-grant-revocation.ts`; both share the consent row locks in
 * `oauth-consent-rows.ts`.
 */

const CONSENT_PATH = "/oauth2/consent";
const CONSENT_UPDATE_PATH = "/oauth2/update-consent";
const TOKEN_PATH = "/oauth2/token";

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
 * The refresh token a refresh presented, as its row records it: what finds its chain of rotations, so the
 * tokens minted for a refused request end too. Tokens from Better Auth 1.7 on carry an
 * `authorizationCodeId` shared by every rotation. Older ones have none, so the one refresh token minted for
 * the request is found by what rotation stamps on it: its `createdAt` is the presented token's `rotatedAt`
 * (both stamped from one clock reading during rotation), in the same session, within the presented token's
 * scopes (a refresh can only narrow).
 */
type TPresentedRefreshToken = {
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
const endTokensBeyondScopes = async (
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
  // A row is this request's write only if the provider accepted the request and the row still is as this
  // request's own write left it (`oauth-consent-writes.ts`). Some accepted paths write nothing, such as a
  // `prompt=login` bounce, so acceptance alone isn't enough: a tie left over from earlier must fall back
  // to what every tied row allows. And another request's later write to the row, such as a second tab's
  // approval of the same client, is that request's, never this one's.
  const accepted = !isAPIError((ctx.context as { returned?: unknown }).returned);
  const isOwnWrite = await readOwnConsentWriteCheck();
  const wrote = (consent: TConsentRow) => accepted && isOwnWrite(consent);
  if (isApproval(ctx)) {
    const query = new URLSearchParams((await getOAuthProviderState())?.query ?? "");
    const clientId = query.get("client_id");
    if (!clientId) return null;
    // The provider stores the scopes the user accepted, or every scope the request asked for.
    const bodyScope = (ctx.body as { scope?: unknown }).scope;
    const approved = (typeof bodyScope === "string" ? bodyScope : query.get("scope"))?.split(" ") ?? [];
    const snapshot = await consentSnapshot.get();
    const snapshotRows = snapshot?.userId === userId && snapshot.clientId === clientId ? snapshot.rows : null;
    return {
      savesGrant: accepted,
      previousConsents: overlayConsentPreimages(snapshotRows, await readConsentPreimages()),
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
  if (ended.status !== "settled") return refuseConsentRequest(ended, change, ids);

  ids.clientId = ended.clientId;
  const { savedGrant, endedGrants, refreshTokensDeleted, accessTokensRevoked } = ended;
  if (savedGrant) await applySavedGrant(userId, savedGrant);
  if (endedGrants.length > 0) {
    // As Revoke does once its delete has committed: the relationships go, best-effort, and it is audited.
    await removeDeletedMcpGrants(endedGrants);
    await queueMcpGrantDeletionsAudit({ actorUserId: userId, grants: endedGrants });
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
type TConsentSnapshotRow = TConsentPreimage;

/**
 * The consent rows to put back if the approval fails: the request's snapshot, with each row this request
 * updated replaced by what the update itself replaced (read just before the write, `oauth-consent-writes.ts`)
 * and each row it created dropped, so the restore deletes it. A tab's approval that saved between the
 * snapshot and this request's write is then put back, not undone. `null` when there is neither a snapshot
 * nor a recorded write: nothing names what to put back.
 */
const overlayConsentPreimages = (
  snapshotRows: ReadonlyArray<TConsentSnapshotRow> | null,
  { replaced, createdIds }: Awaited<ReturnType<typeof readConsentPreimages>>
): TConsentSnapshotRow[] | null => {
  if (!snapshotRows && replaced.length === 0 && createdIds.size === 0) return null;
  const byId = new Map((snapshotRows ?? []).map((row) => [row.id, row]));
  for (const row of replaced) byId.set(row.id, row);
  for (const id of createdIds) byId.delete(id);
  return [...byId.values()];
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
 * Puts back, in the caller's transaction (which already holds the client's grant lock), the consent rows
 * this approval wrote, as the snapshot read them: deletes a row it created (none in the snapshot) and writes
 * the snapshot's values back to a row it updated. A row is this approval's write when `isOwnWrite` says so,
 * the test {@link consentBound} uses: the scopes it approved, on the row this approval wrote, still stamped
 * as its write left it. Every other row is left alone, so an approval of the same client in another tab
 * that landed since the snapshot keeps its consent, whether it wrote a row of its own or rewrote this one,
 * and a row deleted since the snapshot (a revoke) stays deleted.
 *
 * Compensation, not a rollback: another approval of the same client that rewrote this row with the same
 * scopes in the same second leaves it exactly as this one wrote it, and it is put back or deleted too.
 * That approval keeps its grant but gets the snapshot's consent back, or none: the refresh check holds its
 * tokens to the snapshot's scopes, or ends them at their next refresh and the consent screen shows again.
 */
const restoreConsents = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string,
  previous: ReadonlyArray<TConsentSnapshotRow>,
  isOwnWrite: (consent: TConsentRow) => boolean
): Promise<void> => {
  const written = (await lockConsents(tx, userId, { clientId }, "update")).filter(isOwnWrite);
  const previousById = new Map(previous.map((row) => [row.id, row]));
  const created = written.filter(({ id }) => !previousById.has(id)).map(({ id }) => id);
  if (created.length > 0) {
    await tx.oauthConsent.deleteMany({ where: { userId, clientId, id: { in: created } } });
  }
  for (const { id } of written) {
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
      await restoreConsents(tx, userId, clientId, previous, change.isLatestWrite);
    });
  } catch (error) {
    logger.error(
      { err: loggableError(error), userId, clientId },
      "OAuth approval failed and restoring its consent failed too"
    );
  }
};

/** An approval the hook refuses: the reason decides the answer, and the grant stays as it was. */
type TConsentRefusal =
  | { status: "selection_unavailable"; field: "organizationIds" | "workspaceIds" }
  | { status: "beyond_scopes" };

/**
 * Refuses an approval, putting the consent back from the snapshot in the grant's transaction, which already
 * holds the grant's lock: a selection the user can't make (422), or a grant the client's scopes narrow to
 * nothing (400). `auth.oauth.*` messages carry the codes to the screen.
 */
const refuseConsent = async (
  tx: Prisma.TransactionClient,
  { userId, clientId, change }: { userId: string; clientId: string; change: TConsentChange },
  refusal: TConsentRefusal
): Promise<TSettledConsent> => {
  if (change.previousConsents) {
    await restoreConsents(tx, userId, clientId, change.previousConsents, change.isLatestWrite);
  }
  return refusal;
};

type TSavedMcpGrant = { before: TStoredMcpGrant | null; after: TStoredMcpGrant };

type TSettledConsent =
  | TConsentRefusal
  | ({
      status: "settled";
      clientId: string;
      savedGrant: TSavedMcpGrant | null;
      /** The grant an approval that asked for no MCP scope ended: removed and audited after the commit. */
      endedGrants: TStoredMcpGrant[];
    } & TTokensBeyondConsent);

/**
 * Answers an approval the hook refused with the status the screen understands: 422 for a selection the user
 * can't make, 400 for a grant the client's scopes leave nothing of. The transaction that refused already
 * put the consent back, when a snapshot named it.
 */
const refuseConsentRequest = (
  refusal: TConsentRefusal,
  change: TConsentChange,
  ids: { userId: string; clientId?: string }
): never => {
  if (!change.previousConsents) warnConsentNotRestored(ids);
  switch (refusal.status) {
    case "selection_unavailable": {
      const kind = refusal.field === "organizationIds" ? "organizations" : "workspaces";
      throw new APIError("UNPROCESSABLE_ENTITY", {
        error: "invalid_request",
        error_description: `Pick only ${kind} you have access to.`,
        code: MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
      });
    }
    case "beyond_scopes":
      throw new APIError("BAD_REQUEST", {
        error: "invalid_request",
        error_description: MCP_GRANT_BEYOND_SCOPES_DETAIL,
        code: MCP_GRANT_BEYOND_SCOPES_CODE,
      });
  }
};

/**
 * Projects a grant Allow saved, so it applies on the client's first call rather than when the outbox
 * delivers (ENG-7153), and audits it.
 */
const applySavedGrant = async (userId: string, savedGrant: TSavedMcpGrant): Promise<void> => {
  await projectMcpGrants([savedGrant.after.id]);
  await queueMcpGrantAudit({
    action: savedGrant.before ? "updated" : "created",
    actorUserId: userId,
    before: savedGrant.before,
    after: savedGrant.after,
  });
};

/**
 * The consent hook's transaction. The workspaces SpiceDB lets the user select are looked up first, before
 * the transaction takes any lock. For an approval, the grant comes first: its row is locked `FOR UPDATE`
 * and the chosen access resolved; a selection the user can't make puts the consent back from the snapshot
 * in this transaction and changes nothing else. Then the consent rows are settled and the cap checked, and
 * only once nothing can refuse the approval is what a narrowing takes away deleted from SpiceDB, the last
 * step before the grant is written (or ended, for an approval that asked for no MCP scope) while the
 * consent rows are locked: a revoke or a refresh check racing the approval sees both or neither. The
 * tokens beyond the consent are ended last. `null` when there is nothing to settle: a `skipConsent`
 * client, or no consent row.
 *
 * The trade-off of deleting after the checks: the SpiceDB call runs while the consent rows are held, so
 * a path that locks them without the grant row (`update-consent`, the refresh check of a token with no MCP
 * scope) can wait on its retries: the 15 seconds `MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS` allows for them.
 * Every other path takes the grant row first, which this transaction holds from the start anyway. Deleting
 * before the checks instead could commit a refusal over relationships already removed.
 */
const settleChangedConsent = async (
  userId: string,
  change: TConsentChange
): Promise<TSettledConsent | null> => {
  const readableWorkspaceIds = await readMcpGrantReadableWorkspaceIds(userId, change.chosenGrant?.access);
  return prisma.$transaction(
    async (tx): Promise<TSettledConsent | null> => {
      const grant = await lockApprovalGrant(tx, { userId, change, readableWorkspaceIds });
      if (!grant || "status" in grant) return grant;

      const consent = await settleConsent(tx, userId, change);
      if (!consent) return null;
      const { clientId, scopes: consentedScopes } = consent;
      const cap = getMcpGrantPermissionsForScopes(consentedScopes);
      const permissions = change.chosenGrant
        ? capMcpGrantPermissions(change.chosenGrant.permissions, cap)
        : cap;
      // A chosen grant the scopes leave nothing of would connect a client that can do nothing (spec story
      // 17): refused, not stored. The consent screen's matrix never offers one; a request made by hand can,
      // since the request's own check (`requireValidMcpGrantOnConsentBeforeHandler`) runs before the cap.
      if (change.chosenGrant && isMcpGrantEmpty(permissions)) {
        return refuseConsent(tx, { userId, clientId, change }, { status: "beyond_scopes" });
      }
      return {
        status: "settled",
        clientId,
        ...(await saveApprovalGrant(tx, { userId, clientId, grant, permissions })),
        ...(await endTokensBeyondScopes(tx, { userId, clientId, consentedScopes })),
      };
    },
    { timeout: MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS }
  );
};

/**
 * The grant an approval saves, as {@link lockApprovalGrant} locked it: its client (`null` for a change
 * that saves none, such as `update-consent`), the grant before the approval, and the access to save,
 * resolved against what the user can select.
 */
type TApprovalGrant = {
  clientId: string | null;
  before: TStoredMcpGrant | null;
  access: TMcpGrantAccessSelection | undefined;
};

/**
 * The first step of {@link settleChangedConsent} for an approval that saves a grant: the user's row, then
 * the grant's row `FOR UPDATE`, and the chosen access resolved. `null` for a `skipConsent` client (or one
 * gone), which the hook leaves alone; a refusal, already put back from the snapshot, for a selection the
 * user can't make. A change that saves no grant locks nothing here.
 */
const lockApprovalGrant = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    change,
    readableWorkspaceIds,
  }: { userId: string; change: TConsentChange; readableWorkspaceIds: ReadonlySet<string> }
): Promise<TApprovalGrant | TSettledConsent | null> => {
  const clientId = change.savesGrant && "clientId" in change.target ? change.target.clientId : null;
  if (!clientId) return { clientId: null, before: null, access: undefined };
  const client = await tx.oauthClient.findUnique({ where: { clientId }, select: { skipConsent: true } });
  if (!client || client.skipConsent) return null;
  // The user's row before the grant: creating the grant row takes it `FOR KEY SHARE` (its foreign key),
  // and a member removal or demotion holds it `FOR UPDATE` while it locks this user's grant and consent
  // rows. Taken last, it would close a cycle with them; taken first, the approval waits for the removal
  // and then finds the consent it ended gone.
  await lockUserForMcpGrantWrite(tx, userId);
  const before = await lockMcpGrant(tx, { userId, clientId });
  const chosen = change.chosenGrant?.access;
  if (!chosen) return { clientId, before, access: undefined };
  // Resolved now, applied to SpiceDB only after every check that can still refuse: a refusal after the
  // delete would leave SpiceDB narrower than the rows it commits.
  const resolved = await resolveMcpGrantNarrowing(tx, {
    userId,
    before,
    access: chosen,
    readableWorkspaceIds,
  });
  if (resolved.status === "unavailable") {
    return refuseConsent(
      tx,
      { userId, clientId, change },
      { status: "selection_unavailable", field: resolved.field }
    );
  }
  return { clientId, before, access: resolved.access };
};

/**
 * The last grant step of {@link settleChangedConsent}, once nothing can refuse the approval: deletes from
 * SpiceDB what a narrowing takes away, then writes the grant. A client that asked for no MCP scope
 * (`openid offline_access`) gets no grant: it could do nothing with one, Authorized apps lists it with
 * Revoke alone, and its refresh needs none. One that had a grant loses it, as Revoke would end it: a grant
 * left in place would keep MCP access and SpiceDB relationships that no consent backs, and Authorized apps
 * would show and edit them.
 */
const saveApprovalGrant = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    grant,
    permissions,
  }: { userId: string; clientId: string; grant: TApprovalGrant; permissions: TMcpGrantPermissions }
): Promise<{ savedGrant: TSavedMcpGrant | null; endedGrants: TStoredMcpGrant[] }> => {
  if (grant.clientId === null) return { savedGrant: null, endedGrants: [] };
  const { before, access } = grant;
  if (isMcpGrantEmpty(permissions)) {
    const endedGrants = before ? await deleteMcpGrants(tx, { userId, clientId: grant.clientId }) : [];
    return { savedGrant: null, endedGrants };
  }
  if (access) await applyMcpGrantNarrowing(before, access);
  const savedGrant = await writeMcpGrant(tx, { userId, clientId, before, permissions, access });
  return { savedGrant, endedGrants: [] };
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

/** Why a refresh was refused, and what ending it ended: logged, never returned to the client. */
type TRefreshRefusal = Readonly<
  { reason: "client_revoked" | "grant_missing" | "consent_revoked" | "consent_narrowed" } & Partial<
    Record<
      "consentsDeleted" | "refreshTokensRevoked" | "refreshTokensDeleted" | "accessTokensRevoked",
      number
    >
  >
>;

/**
 * The refresh check of a `skipConsent` client, which has no consent to check: its grant alone, or, for a
 * token without an MCP scope, which has no grant either, the revocation mark. `null` when the refresh
 * stands; otherwise the client's tokens are revoked, the one just issued included.
 */
const checkSkipConsentRefresh = async (
  tx: Prisma.TransactionClient,
  {
    userId,
    clientId,
    needsGrant,
    createdAt,
  }: { userId: string; clientId: string; needsGrant: boolean; createdAt: Date }
): Promise<TRefreshRefusal | null> => {
  if (!needsGrant) {
    // No grant and no consent to read, so the user's row orders this refresh against a Revoke: Revoke
    // marks first, then holds the row `FOR UPDATE` while it revokes the client's tokens. Waited on here
    // (`FOR KEY SHARE`), a Revoke in flight has marked by the time the mark is read, and one that starts
    // after this commits revokes the token this refresh inserted. A presented token the mark covers was
    // revoked: the one this refresh issued goes too.
    await lockUserForMcpGrantWrite(tx, userId);
    const revokedAt = await readOAuthRevocationTime(userId, clientId);
    if (!isIssuedBeforeRevocation(createdAt.getTime(), revokedAt)) return null;
    return { reason: "client_revoked", ...(await revokeClientTokens(tx, userId, clientId)) };
  }
  // The grant is the connection's liveness check alone. Read `FOR SHARE` after issuance, as for a consent:
  // a Revoke still in flight is waited on and its delete seen, and one that commits later revokes the
  // token this refresh just inserted. Without the check, a refresh that rotated before a Revoke and
  // inserted its token after it would keep a live token.
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
  {
    userId,
    clientId,
    needsGrant,
    presentedToken,
  }: { userId: string; clientId: string; needsGrant: boolean; presentedToken: TPresentedRefreshToken }
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
  const { userId, clientId, scopes, authorizationCodeId, rotatedAt, sessionId, createdAt } = refreshToken;
  // A token without an MCP scope can't call `/api/mcp`, and its client was given no grant (an approval
  // saves none for it): only its consent is checked.
  const needsGrant = !isMcpGrantEmpty(getMcpGrantPermissionsForScopes(scopes));
  const refused = await prisma.$transaction(
    (tx) =>
      refreshToken.client.skipConsent
        ? checkSkipConsentRefresh(tx, { userId, clientId, needsGrant, createdAt })
        : checkConsentedRefresh(tx, {
            userId,
            clientId,
            needsGrant,
            presentedToken: { authorizationCodeId, rotatedAt, sessionId, scopes },
          }),
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
