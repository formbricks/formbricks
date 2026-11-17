import "server-only";
import { defineRequestState, hasRequestState } from "@better-auth/core/context";
import { APIError } from "better-auth/api";
import { createHash } from "node:crypto";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { MCP_OAUTH_CODE_EXPIRES_IN_SECONDS } from "./mcp-oauth-provider-options";
import { redisSecondaryStorage } from "./secondary-storage";

/**
 * A revocation's mark on the sign-in codes issued before it (ADR-0041).
 *
 * Revoke, and every bulk end of a user's OAuth access (member removal, the switch to Dashboard viewer, the
 * retention sweep, SSO recovery), ends the consents, grants and tokens it can find in PostgreSQL. A pending
 * authorization code is none of those: the provider keeps it in Better Auth's secondary storage (Redis),
 * keyed by its hash alone, for `codeExpiresIn` (`MCP_OAUTH_CODE_EXPIRES_IN_SECONDS`), and nothing indexes it
 * by user or client.
 * Exchanged after the revocation, it issues tokens again, and a `skipConsent` client's code exchange gives
 * the user a new grant to the client: the revoked client is back.
 *
 * So a revocation leaves a mark, a Redis key holding when it happened, for as long as a code issued before
 * it can live: one per user and client for Revoke, one per user for a bulk end. The token endpoint refuses
 * an authorization code issued no later than the mark that covers it
 * ({@link refuseCodeIssuedBeforeRevocationBeforeHandler}). A code is stamped to the second, and its pod's
 * clock may differ from the revoking pod's, so one issued within {@link REVOCATION_CLOCK_SKEW_MS} after the
 * revocation is refused too: the user authorizes again.
 */

/** Room for clock skew between the pod that marks and the one that issued the code, in the mark's TTL. */
const REVOCATION_MARK_SKEW_SECONDS = 60;

/**
 * How far apart two pods' clocks may be when a code's issue time is held against a revocation's mark: the
 * code is stamped by the pod that issued it, the mark by the pod that revoked. A code issued up to this
 * long after the mark (by the issuing pod's clock) still counts as issued before it and is refused, so a
 * revoking pod running behind can't let a code it should cover through. Pods keep NTP time, usually within
 * milliseconds; 5 s bounds a badly drifting one while a user who reconnects right after a Revoke only has
 * to authorize again if they do it within those seconds.
 */
export const REVOCATION_CLOCK_SKEW_MS = 5_000;

/**
 * Whether a code issued at `issuedAt` (ms) is covered by a revocation marked at `revokedAt` (ms; `null`
 * for none): issued no later than the mark, allowing {@link REVOCATION_CLOCK_SKEW_MS} between the clocks.
 * The token endpoint's check and the `skipConsent` grant claim both decide by this.
 */
export const isIssuedBeforeRevocation = (issuedAt: number, revokedAt: number | null): boolean =>
  revokedAt !== null && issuedAt <= revokedAt + REVOCATION_CLOCK_SKEW_MS;

/** As long as a code issued before the revocation can live, and a little longer. */
const REVOCATION_MARK_TTL_SECONDS = MCP_OAUTH_CODE_EXPIRES_IN_SECONDS + REVOCATION_MARK_SKEW_SECONDS;

/** The Redis key of the mark for the user's codes: one client's, or every client's without `clientId`. */
export const oauthRevocationMarkKey = (userId: string, clientId?: string): string =>
  clientId ? `oauth-revoked:${userId}:${clientId}` : `oauth-revoked:${userId}`;

/**
 * Marks the user's codes, for `clientId` or for every client, as issued before a revocation. Call it before
 * the revocation's transaction commits, so no code can be exchanged between the commit and the mark. Throws
 * when Redis can't be written: the revocation must then fail rather than leave the codes live.
 *
 * The mark only ever moves forward: two revocations of the same user's client can complete out of order (the
 * later one marks first, the earlier one's write lands second), and the earlier timestamp would then let a
 * code issued between the two through. An older write keeps the newer mark and refreshes its TTL instead.
 */
export const markOAuthRevocation = async ({
  userId,
  clientId,
}: {
  userId: string;
  clientId?: string;
}): Promise<void> => {
  await redisSecondaryStorage.setMax(
    oauthRevocationMarkKey(userId, clientId),
    Date.now(),
    REVOCATION_MARK_TTL_SECONDS
  );
};

/** When the latest revocation covering the user's codes for the client happened, in ms; `null` if none. */
export const readOAuthRevocationTime = async (userId: string, clientId: string): Promise<number | null> => {
  const marks = await Promise.all([
    redisSecondaryStorage.get(oauthRevocationMarkKey(userId)),
    redisSecondaryStorage.get(oauthRevocationMarkKey(userId, clientId)),
  ]);
  const times = marks.map(Number).filter((time) => Number.isFinite(time) && time > 0);
  return times.length > 0 ? Math.max(...times) : null;
};

const TOKEN_PATH = "/oauth2/token";

/** The authorization code this request is exchanging, as the token endpoint's before-hook read it. */
export type TExchangedCode = { userId: string; clientId: string; issuedAt: number };

const exchangedCode = defineRequestState<TExchangedCode | null>(() => null);

/**
 * The authorization code this request is exchanging, and when it was issued; `null` outside a code
 * exchange. Set by {@link refuseCodeIssuedBeforeRevocationBeforeHandler} for the grant claim
 * (`mcp-grant-token-claim.ts`), which must re-check the revocation mark before it names or creates a
 * grant: the hook's read happens before the provider spends the code, so a Revoke can land between the two.
 */
export const readExchangedAuthorizationCode = async (): Promise<TExchangedCode | null> =>
  (await hasRequestState()) ? exchangedCode.get() : null;

/**
 * The provider stores an authorization code as the unpadded base64url SHA-256 of its value
 * (`storeTokens: "hashed"`, the provider's `defaultHasher`), as it does a refresh token. Not exported
 * upstream, so it is restated; the integration suite fails if a provider upgrade changes it.
 */
const hashAuthorizationCode = (code: string): string => createHash("sha256").update(code).digest("base64url");

const readCodeOwner = (value: string): { userId: string; clientId: string } | null => {
  try {
    const parsed = JSON.parse(value) as { userId?: unknown; query?: { client_id?: unknown } };
    const clientId = parsed.query?.client_id;
    return typeof parsed.userId === "string" && typeof clientId === "string"
      ? { userId: parsed.userId, clientId }
      : null;
  } catch {
    return null;
  }
};

/**
 * `hooks.before` for `POST /oauth2/token`: refuses, with `invalid_grant` as the provider refuses a spent
 * code, an authorization code issued no later than a revocation that covers its user and client. Reads the
 * code without consuming it; the provider consumes it when the exchange goes ahead. A code the provider
 * doesn't know, or can't read, is left to the provider to refuse.
 *
 * A code it accepts is recorded ({@link readExchangedAuthorizationCode}) so the grant claim re-checks the
 * mark before it names a grant, and before it creates a `skipConsent` client's grant: the provider spends
 * the code after this read, and a Revoke committed in the meantime must still leave the token without one.
 */
export const refuseCodeIssuedBeforeRevocationBeforeHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== TOKEN_PATH) return;
  const body = ctx.body as { grant_type?: unknown; code?: unknown } | undefined;
  if (body?.grant_type !== "authorization_code" || typeof body.code !== "string" || body.code === "") return;

  const verification = await ctx.context.internalAdapter.findVerificationValue(
    hashAuthorizationCode(body.code)
  );
  const owner = verification ? readCodeOwner(verification.value) : null;
  if (!verification || !owner) return;

  const issuedAt = new Date(verification.createdAt).getTime();
  await exchangedCode.set({ ...owner, issuedAt });

  const revokedAt = await readOAuthRevocationTime(owner.userId, owner.clientId);
  if (!isIssuedBeforeRevocation(issuedAt, revokedAt)) return;

  throw new APIError("BAD_REQUEST", { error: "invalid_grant", error_description: "invalid code" });
};
