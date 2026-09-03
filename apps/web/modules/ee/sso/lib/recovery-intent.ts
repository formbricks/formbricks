import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { VERIFICATION_LINK_TTL_SECONDS } from "@/modules/auth/lib/verification-links";

/**
 * SSO recovery intent storage (ENG-2783) — what a recovery attempt has to remember between the SSO
 * collision and the moment the user proves control of the mailbox.
 *
 * It used to be a JWT in the URL. That URL then became the *next* attempt's `callbackUrl`, so every
 * retry encrypted the previous attempt's whole URL inside the new one: `symmetricEncrypt` is hex, which
 * doubles, and the JWT's base64url adds another third — ~2.7x per attempt, measured 79 -> 1092 -> 3793
 * -> 10996 characters. nginx's `large_client_header_buffers` defaults to `4 8k` and a request line may
 * not exceed one buffer, so attempt three came back as a bare `414 Request-URI Too Large`. There is no
 * starting length at which nesting is safe, so the payload has to leave the URL entirely.
 *
 * What replaces it is the shape RFC 9126 reached for the same reason — a short opaque reference to
 * server-side state. RFC 6750 s5.2 ("Bearer tokens SHOULD NOT be passed in page URLs") and RFC 9700
 * s2.1 (state should be opaque and one-time) point the same way, and it drops the encrypted `userId` /
 * `email` / `providerAccountId` out of nginx access logs and browser history as a side effect.
 *
 * ## Why not a cookie, like `modules/auth/lib/signup-intent.ts`
 *
 * Because this state has to survive the *mail* hop. `startSsoRecovery` hands the completion URL to
 * `sendVerificationEmail`, and `buildVerificationLinks` puts it on the emailed magic link itself, so the
 * browser that finishes recovery may not be the browser that started it — a different device entirely.
 * A cookie set at the start would simply be absent there, which is a hard break rather than a
 * degradation. `signup-intent.ts` is same-browser BY DESIGN (that is the whole of ENG-2562: it exists to
 * withhold a session from a browser that did not sign up); recovery cannot require the same thing.
 *
 * ## Why Redis is an acceptable home for it
 *
 * `REDIS_URL` is a required env var — the app does not boot without it — and Better Auth already keeps
 * sessions, verification records and OAuth state there via `secondaryStorage`. Note what that means for
 * the trust model: the JWT this replaces was signed, and a Redis value is not, so the integrity of the
 * record now rests on `parseStoredIntent` below plus the guards in `completeSsoRecovery`. That is a fair
 * trade rather than a downgrade, because anyone who can write this Redis can mint a Better Auth session
 * outright and never needs to forge an intent.
 */

/** 32 bytes, so guessing is out of reach — RFC 9126 s2.2 wants a value "infeasible to predict or guess". */
const STATE_ENTROPY_BYTES = 32;

/** Exactly what {@link toBase64Url} produces for 32 bytes. Checked before Redis is ever touched. */
const STATE_ID_REGEX = /^[A-Za-z0-9_-]{43}$/;

const INTENT_TTL_MS = VERIFICATION_LINK_TTL_SECONDS * 1000;

/**
 * Ceiling on one intent's total life, however many times it is refreshed.
 *
 * The refresh exists so a resent link does not outlive the intent it needs (same pairing problem as the
 * sign-up intent cookie). But `resendVerificationEmailAction` is unauthenticated, so a plain sliding
 * window would let anyone holding a state id keep a record alive forever. `createdAt` is written once
 * and never moved, so measuring from it caps the slide.
 */
const INTENT_MAX_LIFETIME_MS = 60 * 60 * 24 * 7 * 1000;

const ZStoredSsoRecoveryIntent = z.object({
  userId: z.string().min(1),
  email: z.string().min(1),
  provider: z.string().min(1),
  providerAccountId: z.string().min(1),
  callbackUrl: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

export type TSsoRecoveryIntent = z.infer<typeof ZStoredSsoRecoveryIntent>;

const toBase64Url = (buffer: Buffer) =>
  buffer.toString("base64").replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");

/**
 * The cache key is the HASH of the state id, never the id itself, so a Redis dump yields nothing
 * usable — same reasoning as `lib/oauth/integration-state.ts`. It is also the only form of the id that
 * may appear in a log line.
 */
const hashStateId = (stateId: string) => crypto.createHash("sha256").update(stateId).digest("hex");

const getIntentCacheKey = (stateIdHash: string) =>
  createCacheKey.custom("sso_recovery", "intent", stateIdHash);

/**
 * Store an intent and return the opaque id that stands for it in the URL.
 *
 * Throws when the write fails: without a stored intent the completion route has nothing to act on, so
 * continuing would send the user an email whose link cannot work. Fail closed — this record decides
 * whether an SSO identity gets linked to an account.
 */
export const createSsoRecoveryIntent = async (
  intent: Omit<TSsoRecoveryIntent, "createdAt">
): Promise<string> => {
  const stateId = toBase64Url(crypto.randomBytes(STATE_ENTROPY_BYTES));
  const stateIdHash = hashStateId(stateId);
  const record: TSsoRecoveryIntent = { ...intent, createdAt: Date.now() };

  const result = await cache.set(getIntentCacheKey(stateIdHash), record, INTENT_TTL_MS);

  if (!result.ok) {
    logger.error(
      { error: result.error, stateIdHash, userId: intent.userId },
      "Failed to store the SSO recovery intent"
    );
    throw new Error("Unable to store the SSO recovery intent");
  }

  return stateId;
};

/**
 * Validate the stored value field by field rather than casting it.
 *
 * This is the check that replaces the JWT's signature. Two fields make it load-bearing rather than
 * defensive: `callbackUrl` becomes a redirect (its origin is re-checked by `getValidatedCallbackUrl`
 * downstream, but only if it is a string at all), and `providerAccountId` becomes the SSO identity
 * linked to the account. A cast would hand both to whatever happened to be under the key.
 */
const parseStoredIntent = (value: unknown): TSsoRecoveryIntent | null => {
  const parsed = ZStoredSsoRecoveryIntent.safeParse(value);

  return parsed.success ? parsed.data : null;
};

/**
 * Read an intent WITHOUT consuming it.
 *
 * Deliberately non-consuming, and the reason is the inbox: mail security gateways (Defender Safe Links,
 * Proofpoint, Mimecast) fetch every link in a message before the human sees it, and the emailed link
 * redirects here. Burning the record on read would let a scanner spend it and lock the real user out —
 * the classic way one-time email links break in corporate mail. RFC 9126 s4 allows exactly this
 * latitude: one-time use SHOULD, "but MAY allow for duplicate requests due to a user
 * reloading/refreshing their user agent." Consumption happens after a completion commits, in
 * {@link consumeSsoRecoveryIntent}.
 *
 * Returns `null` rather than throwing — for a missing record, a malformed one, and an unreachable Redis
 * alike. The caller is an unauthenticated GET that must degrade to the recovery-failed redirect, never
 * to a 500.
 */
export const readSsoRecoveryIntent = async (
  stateId: string | null | undefined
): Promise<TSsoRecoveryIntent | null> => {
  if (!stateId || !STATE_ID_REGEX.test(stateId)) {
    return null;
  }

  const stateIdHash = hashStateId(stateId);
  const result = await cache.get<unknown>(getIntentCacheKey(stateIdHash));

  if (!result.ok) {
    logger.error({ error: result.error, stateIdHash }, "Failed to read the SSO recovery intent");
    return null;
  }

  if (result.data === null) {
    // Logged, though a miss is an ordinary outcome (expired, or already consumed): `completeSsoRecovery`
    // reports the failure without a correlation id of its own, and the hash is the only handle an
    // operator can join the two lines on. Recoveries are rare, so this does not add meaningful volume.
    logger.warn({ stateIdHash }, "No SSO recovery intent stored for this state");
    return null;
  }

  const intent = parseStoredIntent(result.data);
  if (!intent) {
    logger.error({ stateIdHash }, "Discarded a malformed SSO recovery intent");
  }

  return intent;
};

/**
 * Single-use, applied at the only moment it is safe to: after the account link has committed.
 *
 * Best-effort, never throws. The link already happened, so failing here must not turn a completed
 * recovery into an error — the record expires on its own.
 */
export const consumeSsoRecoveryIntent = async (stateId: string): Promise<void> => {
  if (!STATE_ID_REGEX.test(stateId)) {
    return;
  }

  const stateIdHash = hashStateId(stateId);
  const result = await cache.del([getIntentCacheKey(stateIdHash)]);

  if (!result.ok) {
    logger.error({ error: result.error, stateIdHash }, "Failed to consume the SSO recovery intent");
  }
};

/**
 * Re-pair the intent with a link that was just resent.
 *
 * A resend mints a fresh {@link VERIFICATION_LINK_TTL_SECONDS} link, so without this the new link
 * outlives the intent it depends on and the user is signed in only to be told recovery failed — the
 * same pairing bug the sign-up intent cookie's resend refresh exists to avoid.
 *
 * Only the expiry moves — the stored record, `createdAt` included, is never rewritten. So every refresh
 * is measured against the original start and the window cannot slide past {@link INTENT_MAX_LIFETIME_MS},
 * which matters because the caller is unauthenticated. Best-effort, never throws: the mail has already
 * gone out, so a failure here costs the pairing, not the resend.
 */
export const refreshSsoRecoveryIntent = async (
  stateId: string,
  intent: TSsoRecoveryIntent
): Promise<void> => {
  if (!STATE_ID_REGEX.test(stateId)) {
    return;
  }

  const remainingLifetimeMs = intent.createdAt + INTENT_MAX_LIFETIME_MS - Date.now();
  if (remainingLifetimeMs <= 0) {
    return;
  }

  const stateIdHash = hashStateId(stateId);
  const ttlSeconds = Math.floor(Math.min(INTENT_TTL_MS, remainingLifetimeMs) / 1000);

  try {
    const redis = await cache.getRedisClient();

    if (!redis) {
      logger.error({ stateIdHash }, "Redis is required to refresh the SSO recovery intent");
      return;
    }

    // EXPIRE rather than writing the record back, for two reasons. It is a no-op on a key that is
    // already gone, so a resend racing a completion cannot resurrect the intent that completion just
    // consumed — a rewrite would, and would quietly undo single use. And it never touches the stored
    // value, so there is no path by which a stale copy read moments earlier gets written back.
    await redis.expire(getIntentCacheKey(stateIdHash), ttlSeconds);
  } catch (error) {
    logger.error({ error, stateIdHash }, "Failed to refresh the SSO recovery intent");
  }
};
