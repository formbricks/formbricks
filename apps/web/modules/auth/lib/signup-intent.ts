import "server-only";
import jwt from "jsonwebtoken";
import { ENCRYPTION_KEY, NEXTAUTH_SECRET } from "@/lib/constants";
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
 *    silently rewritten to `"email_verification"` and returned as if it had been asserted. That makes
 *    `VERIFICATION_TOKEN_PURPOSES` a rewriting allowlist rather than a rejecting one, so `signup_intent`
 *    is deliberately NOT added to it: kept out of that shared keyspace, no lenient consumer can ever
 *    resolve one of these tokens into a purpose it was not issued for.
 * 2. `verifyToken` falls back, on signature failure, to looking the user up by token and re-verifying
 *    with `NEXTAUTH_SECRET + userEmail`. That would put one or two database queries behind every
 *    malformed cookie on an unauthenticated GET — including every mail-scanner prefetch of a
 *    verification link — which is the exact amplification the new rate limits exist to prevent.
 *
 * So: HS256 pinned, strict purpose equality, expiry enforced by `jwt.verify`, no legacy fallback, and no
 * database access. The user id is compared against the already-loaded verified user by the caller.
 */

const SIGNUP_INTENT_PURPOSE = "signup_intent";

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
  maxAge: EMAIL_VERIFICATION_TTL_SECONDS,
} as const;

/**
 * Mint the cookie value for `userId`. Never log the result: it is a bearer value, and the precedent in
 * `auth.ts`'s `sendVerificationEmail` is domain-only logging — never the address, the token, or the URL.
 */
export const createSignupIntentToken = (userId: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  return jwt.sign(
    { id: symmetricEncrypt(userId, ENCRYPTION_KEY), purpose: SIGNUP_INTENT_PURPOSE },
    NEXTAUTH_SECRET,
    { algorithm: "HS256", expiresIn: EMAIL_VERIFICATION_TTL_SECONDS }
  );
};

/**
 * The user id this cookie was issued for, or `null` for anything that is not a currently-valid
 * sign-up intent — absent, malformed, expired, wrong signature, wrong algorithm, or carrying any
 * purpose other than `signup_intent`.
 *
 * Returns rather than throws, and never logs the token, because the caller runs inside a verification
 * request that must not fail on a bad cookie: a garbage cookie has to degrade to "no proof", which
 * withholds the session, not to a 500 on a link that already verified the user.
 */
export const readSignupIntentUserId = (cookieValue: string | null | undefined): string | null => {
  if (!cookieValue || !NEXTAUTH_SECRET || !ENCRYPTION_KEY) return null;

  try {
    // `algorithms` pinned so a token cannot dictate its own verification algorithm, and `expiresIn`
    // above means `jwt.verify` rejects a stale cookie for us.
    const payload = jwt.verify(cookieValue, NEXTAUTH_SECRET, { algorithms: ["HS256"] });
    if (typeof payload !== "object" || payload === null) return null;

    const { id, purpose } = payload as { id?: unknown; purpose?: unknown };
    // Strict equality, no defaulting. This is the check that keeps a token minted for another flow
    // (`email_verification`, `sso_recovery`, a gateway token) from being spent here.
    if (purpose !== SIGNUP_INTENT_PURPOSE) return null;
    if (typeof id !== "string" || id.length === 0) return null;

    const userId = symmetricDecrypt(id, ENCRYPTION_KEY);

    return userId.length > 0 ? userId : null;
  } catch {
    return null;
  }
};
