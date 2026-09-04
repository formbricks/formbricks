import "server-only";
import jwt from "jsonwebtoken";
import { BETTER_AUTH_SECRET, ENCRYPTION_KEY, NEXTAUTH_SECRET } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { EMAIL_VERIFICATION_TTL_SECONDS, USE_SECURE_COOKIES } from "./auth-cookies";

/**
 * Sign-up intent cookie (ENG-2562) — evidence that THIS browser is the one that registered an account.
 *
 * Clicking a verification link proves the clicker controls the mailbox. It does NOT prove the clicker
 * chose the account's password, and `autoSignInAfterVerification` used to treat the two as the same
 * thing: an attacker could register a victim's address with a password of the attacker's choosing, and
 * the victim's click would sign the victim into the attacker's account. This cookie is the missing
 * discriminator — set when a sign-up creates an account, checked when a verification completes — so the
 * session is only ever handed to the browser that actually signed up.
 *
 * It is not a credential and grants nothing on its own: without the emailed verification token there is
 * no request it can influence, and the attacker's copy (of an account they created) is inert because the
 * token goes to the victim's inbox.
 *
 * ## Why this does not use `verifyToken` from `lib/jwt.ts`
 *
 * Two reasons, both found in the security review of the ENG-2562 plan:
 *
 * 1. `getVerificationTokenPurpose` there **fails open** — an absent or unrecognised `purpose` claim is
 *    silently rewritten to `"email_verification"` and returned as if it had been asserted. Staying out of
 *    `VERIFICATION_TOKEN_PURPOSES` is therefore NOT protection on its own; it is precisely what would make
 *    `verifyToken` rewrite one of these tokens into a purpose it was never issued for. What actually keeps
 *    the two keyspaces apart is the claim names used below — `uid`/`kind` rather than `id`/`purpose` — so a
 *    token minted here cannot be parsed by `verifyToken` at all: it bails on `if (!payload?.id)` before any
 *    purpose is considered. Not exploitable either way today, since that helper's only caller demands
 *    `sso_recovery` — but a future consumer trusting a returned `email_verification` would otherwise have
 *    accepted this cookie, because both sign with the same secret on a deployment that sets only
 *    `NEXTAUTH_SECRET`.
 * 2. `verifyToken` falls back, on signature failure, to looking the user up by token and re-verifying
 *    with `NEXTAUTH_SECRET + userEmail`. That would put one or two database queries behind every
 *    malformed cookie on an unauthenticated GET — including every mail-scanner prefetch of a
 *    verification link — which is the exact amplification the new rate limits exist to prevent.
 *
 * So: HS256 pinned, strict `kind` equality, expiry enforced by `jwt.verify`, no legacy fallback, and no
 * database access. The user id is compared against the already-loaded verified user by the caller.
 */

const SIGNUP_INTENT_KIND = "signup_intent";

// Same chain as auth.ts's Better Auth `secret`: NEXTAUTH_SECRET is `optional()` in the env schema and
// a deployment may run on BETTER_AUTH_SECRET alone, so pinning this token to NEXTAUTH_SECRET would
// make sign-up throw on exactly the configuration auth.ts goes out of its way to support.
const SIGNING_SECRET = BETTER_AUTH_SECRET ?? NEXTAUTH_SECRET;

/**
 * Better Auth is configured with `cookiePrefix: "formbricks"` and adds `__Secure-` under
 * `useSecureCookies`, so this mirrors both. The `signup_intent` suffix is not a name Better Auth mints,
 * so the two namespaces cannot collide.
 */
export const SIGNUP_INTENT_COOKIE_NAME = `${USE_SECURE_COOKIES ? "__Secure-" : ""}formbricks.signup_intent`;

/** Cookie attributes, matching Better Auth's `advanced.defaultCookieAttributes`, with one exception. */
export const SIGNUP_INTENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: USE_SECURE_COOKIES,
  path: "/",
  // `lax`, not `strict`: the verification link is a top-level GET navigation arriving from a mail
  // client, i.e. cross-site. `strict` would withhold the cookie on exactly the request that needs it,
  // turning every legitimate same-browser sign-up into a withheld session.
  sameSite: "lax",
  // Paired with the verification token's TTL — but the pairing only holds for the CURRENT link. A
  // resent link gets a fresh hour, so the resend action re-issues this cookie alongside it when (and
  // only when) the requesting browser already holds a valid one for the same user
  // (verification-requested/actions.ts). A browser whose cookie has already expired cannot be told
  // apart from one that never signed up, so a resend after expiry stays on the withheld path.
  maxAge: EMAIL_VERIFICATION_TTL_SECONDS,
} as const;

/**
 * Mint the cookie value for `userId`. Never log the result: it is a bearer value, and the precedent in
 * `auth.ts`'s `sendVerificationEmail` is domain-only logging — never the address, the token, or the URL.
 */
export const createSignupIntentToken = (userId: string): string => {
  if (!SIGNING_SECRET) {
    throw new Error("Neither BETTER_AUTH_SECRET nor NEXTAUTH_SECRET is set");
  }
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  // `uid`/`kind`, not `id`/`purpose` — see the header. Sharing `createToken`'s claim shape is what would
  // let `verifyToken` resolve this cookie as an `email_verification` token.
  return jwt.sign(
    { uid: symmetricEncrypt(userId, ENCRYPTION_KEY), kind: SIGNUP_INTENT_KIND },
    SIGNING_SECRET,
    { algorithm: "HS256", expiresIn: EMAIL_VERIFICATION_TTL_SECONDS }
  );
};

/**
 * What a sign-up intent cookie says, and — when it says nothing usable — why.
 *
 * The reason is not decoration. The withheld path is reached by the ordinary cross-device click and by a
 * mail-scanner prefetch as well as by a genuine pre-hijack, so collapsing all of them into one boolean
 * throws away the only distinction the record exists to make: `absent` is the common, boring case, while
 * `invalid` and `other_user` are the ones worth looking at. It cannot be recovered after the fact.
 */
export type TSignupIntentRead =
  | { userId: string; reason: "valid" }
  | { userId: null; reason: "absent" | "invalid" };

/**
 * Read the cookie. `absent` is no cookie at all (or no secrets configured); `invalid` covers malformed,
 * expired, wrong signature, wrong algorithm, and the wrong `kind`.
 *
 * Returns rather than throws, and never logs the token, because the caller runs inside a verification
 * request that must not fail on a bad cookie: a garbage cookie has to degrade to "no proof", which
 * withholds the session, not to a 500 on a link that already verified the user.
 */
export const readSignupIntent = (cookieValue: string | null | undefined): TSignupIntentRead => {
  if (!cookieValue || !SIGNING_SECRET || !ENCRYPTION_KEY) return { userId: null, reason: "absent" };

  try {
    // `algorithms` pinned so a token cannot dictate its own verification algorithm, and `expiresIn`
    // above means `jwt.verify` rejects a stale cookie for us.
    const payload = jwt.verify(cookieValue, SIGNING_SECRET, { algorithms: ["HS256"] });
    if (typeof payload !== "object" || payload === null) return { userId: null, reason: "invalid" };

    const { uid, kind } = payload as { uid?: unknown; kind?: unknown };
    // Strict equality, no defaulting. This is the check that keeps a token minted for another flow
    // from being spent here, on top of the claim names that stop it parsing as one at all.
    if (kind !== SIGNUP_INTENT_KIND) return { userId: null, reason: "invalid" };
    if (typeof uid !== "string" || uid.length === 0) return { userId: null, reason: "invalid" };

    const userId = symmetricDecrypt(uid, ENCRYPTION_KEY);

    return userId.length > 0 ? { userId, reason: "valid" } : { userId: null, reason: "invalid" };
  } catch {
    return { userId: null, reason: "invalid" };
  }
};

/**
 * Why the post-verification session was withheld, for the log line and the audit row.
 *
 * `other_user` is the genuinely suspicious one — a valid cookie for a different account. `grant_failed`
 * is an internal fault, not a judgement about the caller.
 */
export type TWithheldReason = "absent" | "invalid" | "other_user" | "grant_failed";

/** Classify the cookie against the user this request just verified. */
export const classifySignupIntent = (
  cookieValue: string | null | undefined,
  verifiedUserId: string
): "valid" | Exclude<TWithheldReason, "grant_failed"> => {
  const intent = readSignupIntent(cookieValue);
  if (intent.reason !== "valid") return intent.reason;

  return intent.userId === verifiedUserId ? "valid" : "other_user";
};
