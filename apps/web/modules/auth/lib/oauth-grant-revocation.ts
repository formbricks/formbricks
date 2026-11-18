import "server-only";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { readMcpGrantReadableWorkspaceIds } from "@/modules/mcp/access-options";
import {
  type TMcpGrantAccessSelection,
  type TMcpGrantPermissions,
  capMcpGrantPermissions,
  getMcpGrantPermissionsForScopes,
  isMcpGrantEmpty,
} from "@/modules/mcp/grant";
import {
  type TMcpGrantAuditRecord,
  prepareMcpGrantAudits,
  queueMcpGrantAudits,
} from "@/modules/mcp/grant-audit";
import {
  MCP_GRANT_SAVE_TRANSACTION_TIMEOUT_MS,
  type TStoredMcpGrant,
  applyMcpGrantNarrowing,
  deleteMcpGrants,
  lockMcpGrant,
  lockUserForMcpGrantWrite,
  projectMcpGrants,
  removeDeletedMcpGrants,
  resolveMcpGrantNarrowing,
  writeMcpGrant,
} from "@/modules/mcp/grant-store";
import { MCP_GRANT_NOT_SAVED_CODE, MCP_GRANT_NOT_SAVED_DETAIL } from "./mcp-grant-consent-errors";
import {
  CONSENT_PATH,
  CONSENT_UPDATE_PATH,
  type TConsentChange,
  consentChange,
  isAcceptedApproval,
} from "./oauth-consent-change";
import {
  type TConsentRefusal,
  refuseConsent,
  refuseConsentRequest,
  restoreConsentAfterFailedApproval,
  restoreMcpGrantRelationships,
} from "./oauth-consent-restore";
import { type TConsentRow, consentBound, lockConsents } from "./oauth-consent-rows";
import { type TTokensBeyondConsent, endTokensBeyondScopes } from "./oauth-consent-tokens";

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
 * This module holds the consent hook that follows an approval or `update-consent`: it settles the consent,
 * saves the grant, and ends the tokens beyond the consent. What the request changed is read in
 * `oauth-consent-change.ts`, a failed approval is put back by `oauth-consent-restore.ts`, the tokens are
 * ended by `oauth-consent-tokens.ts`, and the refresh check lives in `oauth-refresh-check.ts`. Ending a
 * grant — Revoke, and every bulk end of a user's OAuth access — lives in `mcp-grant-revocation.ts`; all
 * share the consent row locks in `oauth-consent-rows.ts`.
 */

/**
 * The consent hook's read: the client, its bound, and the row the bound rests on, with the client's consent
 * rows locked. `null` for a `skipConsent` client, whose tokens the provider issues without consulting
 * consent, or without a consent row. Changes nothing: a refusal must leave the rows as they were, so
 * duplicates are folded ({@link foldDuplicateConsents}) only once nothing can refuse the approval.
 */
const readSettledConsent = async (
  tx: Prisma.TransactionClient,
  userId: string,
  change: TConsentChange
): Promise<TSettledConsentRow | null> => {
  const consents = await lockConsents(tx, userId, change.target, "update");
  if (consents.length === 0 || consents[0].skipConsent) return null;
  const bound = consentBound(consents, change.isLatestWrite);
  if (!bound) return null;
  return {
    clientId: consents[0].clientId,
    scopes: bound.scopes,
    newest: bound.newest,
    hasDuplicates: consents.length > 1,
  };
};

type TSettledConsentRow = {
  clientId: string;
  scopes: string[];
  newest: TConsentRow;
  hasDuplicates: boolean;
};

/**
 * Folds the client's duplicate consent rows into the one the bound rests on. The provider's `/authorize`
 * looks a consent up with an unordered `findOne`, so a stale wider duplicate would otherwise keep skipping
 * the consent screen and minting wide codes after the user narrowed the other row. Run under the locks
 * {@link readSettledConsent} took.
 */
const foldDuplicateConsents = async (
  tx: Prisma.TransactionClient,
  userId: string,
  { clientId, scopes, newest, hasDuplicates }: TSettledConsentRow
): Promise<void> => {
  if (!hasDuplicates) return;
  await tx.oauthConsent.deleteMany({ where: { userId, clientId, id: { not: newest.id } } });
  if (scopes.length !== newest.scopes.length) {
    await tx.oauthConsent.update({ where: { id: newest.id }, data: { scopes } });
  }
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
  const { savedGrant, endedGrants, grantAudits, refreshTokensDeleted, accessTokensRevoked } = ended;
  // A saved grant is projected now, so it applies on the client's first call rather than when the outbox
  // delivers (ENG-7153); an ended one's relationships go, best-effort, as Revoke's do after its commit.
  if (savedGrant) await projectMcpGrants([savedGrant.after.id]);
  if (endedGrants.length > 0) await removeDeletedMcpGrants(endedGrants);
  await queueMcpGrantAudits({ userId, userType: "user" }, grantAudits);
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

type TSavedMcpGrant = { before: TStoredMcpGrant | null; after: TStoredMcpGrant };

export type TSettledConsent =
  | TConsentRefusal
  | ({
      status: "settled";
      clientId: string;
      savedGrant: TSavedMcpGrant | null;
      /** The grant an approval that asked for no MCP scope ended: removed and audited after the commit. */
      endedGrants: TStoredMcpGrant[];
      /** The saved or ended grant's audit entries, prepared in the transaction: queued after the commit. */
      grantAudits: TMcpGrantAuditRecord[];
    } & TTokensBeyondConsent);

/**
 * The audit entries of what an approval saved or ended, read in its transaction, so they name the
 * organizations the grant reached as it changed, as Edit and Revoke do.
 */
const prepareApprovalAudits = (
  tx: Prisma.TransactionClient,
  { savedGrant, endedGrants }: { savedGrant: TSavedMcpGrant | null; endedGrants: TStoredMcpGrant[] }
): Promise<TMcpGrantAuditRecord[]> =>
  prepareMcpGrantAudits(tx, [
    ...(savedGrant
      ? [
          {
            action: savedGrant.before ? ("updated" as const) : ("created" as const),
            before: savedGrant.before,
            after: savedGrant.after,
          },
        ]
      : []),
    ...endedGrants.map((before) => ({ action: "deleted" as const, before, after: null })),
  ]);

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

      const consent = await readSettledConsent(tx, userId, change);
      if (!consent) return null;
      const { clientId, scopes: consentedScopes } = consent;
      // An approval saves its grant only while the consent is its own write. Another tab's approval of the
      // same client that wrote after it owns the decision, and its own hook saves that grant: this one's
      // choice, even with the same scopes, would overwrite it.
      const ownsDecision = grant.clientId !== null && change.isLatestWrite(consent.newest);
      const cap = getMcpGrantPermissionsForScopes(consentedScopes);
      const permissions = change.chosenGrant
        ? capMcpGrantPermissions(change.chosenGrant.permissions, cap)
        : cap;
      // A chosen grant the scopes leave nothing of would connect a client that can do nothing (spec story
      // 17): refused, not stored. The consent screen's matrix never offers one; a request made by hand can,
      // since the request's own check (`requireValidMcpGrantOnConsentBeforeHandler`) runs before the cap.
      if (ownsDecision && change.chosenGrant && isMcpGrantEmpty(permissions)) {
        return refuseConsent(tx, { userId, clientId, change }, { status: "beyond_scopes" });
      }
      await foldDuplicateConsents(tx, userId, consent);
      const saved = ownsDecision
        ? await saveApprovalGrant(tx, { userId, clientId, grant, permissions })
        : { savedGrant: null, endedGrants: [] };
      return {
        status: "settled",
        clientId,
        ...saved,
        grantAudits: await prepareApprovalAudits(tx, saved),
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
