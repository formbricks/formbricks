import "server-only";
import { defineRequestState } from "@better-auth/core/context";
import { getOAuthProviderState, verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { getSessionFromCtx, isAPIError } from "better-auth/api";
import { prisma } from "@formbricks/database";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { type TRequestedMcpGrant } from "@/modules/mcp/grant";
import { getApprovedMcpGrant } from "./mcp-grant-consent";
import { type TConsentRow, type TConsentTarget } from "./oauth-consent-rows";
import {
  type TConsentPreimage,
  readConsentPreimages,
  readOwnConsentWriteCheck,
} from "./oauth-consent-writes";

/**
 * What a consent request changed, read from the request alone (`consentChange`), and the consent rows an
 * approval found before the provider wrote it (`snapshotConsentBeforeApprovalHandler`), for the consent hook
 * in `oauth-grant-revocation.ts`.
 */

export const CONSENT_PATH = "/oauth2/consent";

export const CONSENT_UPDATE_PATH = "/oauth2/update-consent";

/**
 * What a consent request changed, read from the request alone; `null` for any other request. For
 * `/oauth2/consent`, the client comes from the provider's own request state, the verified authorization
 * query the endpoint itself read the client from. `isLatestWrite` names the row the request wrote, for
 * {@link consentBound}'s same-second tie.
 */
export type TConsentChange = {
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
  previousConsents: TConsentPreimage[] | null;
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

export const isAcceptedApproval = (ctx: AuthHookContext): boolean =>
  isApproval(ctx) && !isAPIError((ctx.context as { returned?: unknown }).returned);

const sameScopes = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((scope) => b.includes(scope));

export const consentChange = async (ctx: AuthHookContext, userId: string): Promise<TConsentChange | null> => {
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
 * The consent rows to put back if the approval fails: the request's snapshot, with each row this request
 * updated replaced by what the update itself replaced (read just before the write, `oauth-consent-writes.ts`)
 * and each row it created dropped, so the restore deletes it. A tab's approval that saved between the
 * snapshot and this request's write is then put back, not undone. `null` when there is neither a snapshot
 * nor a recorded write: nothing names what to put back.
 */
const overlayConsentPreimages = (
  snapshotRows: ReadonlyArray<TConsentPreimage> | null,
  { replaced, createdIds }: Awaited<ReturnType<typeof readConsentPreimages>>
): TConsentPreimage[] | null => {
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
  rows: TConsentPreimage[];
} | null>(() => null);

/**
 * `hooks.before` for `POST /oauth2/consent`: reads the client's consent rows of an Allow before the provider
 * writes the consent, so an approval whose grant can't be saved can put them back.
 *
 * Better Auth's consent endpoint writes the consent through its adapter, outside any transaction this
 * module could join (our Prisma adapter runs without them), and before the after-hook saves the grant. So
 * a failed save can't roll that write back; the after-hook undoes it instead, from this snapshot
 * (`restoreConsents` (`oauth-consent-restore.ts`)). The client is the one the signed authorization query names, verified here as
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
