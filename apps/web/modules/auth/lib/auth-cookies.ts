import "server-only";
import { env } from "@/lib/env";

/**
 * Cookie/token settings shared by `auth.ts` and the sign-up intent cookie (ENG-2562).
 *
 * Extracted rather than exported from `auth.ts` to keep the import graph acyclic: `signup-intent.ts`
 * is reached from `auth.ts` (→ `after-auth-hooks.ts` → `better-auth-verification-autosignin.ts`), so
 * importing `auth.ts` back from there would close a cycle. A leaf module both sides can import is the
 * cheap way out — the same reason `session-revocation.ts` reaches for `auth` dynamically.
 */

/**
 * `__Secure-`/Secure cookies require HTTPS — on http://localhost the browser drops them and the session
 * can't persist. Gate on the configured URL scheme (parity with NextAuth's URL-based useSecureCookies
 * default) instead of hardcoding true, so local/dev over http works.
 *
 * WEBAPP_URL is part of the chain because all three vars are optional: a deployment that sets only
 * WEBAPP_URL=https://… — the primary documented variable — would otherwise fall through to "" and serve
 * the session cookie without `Secure`, letting a downgrade to plaintext HTTP leak it.
 */
export const USE_SECURE_COOKIES = (
  env.BETTER_AUTH_URL ??
  env.NEXTAUTH_URL ??
  env.WEBAPP_URL ??
  ""
).startsWith("https://");

/**
 * Lifetime of a verification link, and therefore of the sign-up intent cookie that has to outlive it.
 *
 * One constant on purpose: the intent cookie exists to answer "is the browser presenting this
 * verification link the one that registered?", so a cookie that died before the link it is paired with
 * would silently withhold the session from a legitimate same-browser sign-up — the exact UX ENG-1746
 * added and this fix is meant to preserve. Consumed by `emailVerification.expiresIn` in `auth.ts` and
 * by `issueSignupIntentCookie`.
 */
export const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60;
