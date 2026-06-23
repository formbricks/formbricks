import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Better Auth session cookie names — `cookiePrefix: "formbricks"` + `useSecureCookies: true`
 * (modules/auth/lib/auth.ts `advanced`) yield the browser-enforced `__Secure-` prefix on HTTPS; the
 * unprefixed form covers non-secure dev. (ENG-1054 cutover — replaces the NextAuth cookie names.)
 */
export const BETTER_AUTH_SESSION_COOKIE_NAMES = [
  "__Secure-formbricks.session_token",
  "formbricks.session_token",
] as const;

type TCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

const decode = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * Verify Better Auth's signed cookie value and return the unsigned session token (the value stored
 * in `Session.sessionToken`), or `null` if absent or tampered with.
 *
 * Better Auth signs the cookie via better-call's `serializeSignedCookie`: the value is
 * `` `${token}.${signature}` `` where `signature = base64(HMAC-SHA256(token, BETTER_AUTH_SECRET))`
 * (standard base64; see better-call `crypto.mjs` `makeSignature`). We recompute that HMAC with the
 * same secret and constant-time-compare — so a raw `prisma.session.findUnique` can look the token up.
 * Fails closed: a missing secret or an invalid signature returns `null`.
 */
const verifyAndExtractSessionToken = (signedValue: string | null): string | null => {
  // Must match auth.ts's secret resolution (BETTER_AUTH_SECRET, else NEXTAUTH_SECRET) so this verifies
  // the cookies Better Auth actually signs — a mismatch rejects every session and loops the user
  // between / and /auth/login. Fails closed when neither secret is set.
  const secret = env.BETTER_AUTH_SECRET ?? env.NEXTAUTH_SECRET;
  if (!signedValue || !secret) {
    return null;
  }

  // The token is a cuid2 (no "."), the signature is standard base64 (no "."), so the single "."
  // cleanly separates them.
  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === signedValue.length - 1) {
    return null;
  }

  const token = signedValue.slice(0, lastDot);
  const signature = signedValue.slice(lastDot + 1);
  const expected = createHmac("sha256", secret).update(token).digest("base64");

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
    return null;
  }

  return token;
};

const getSignedCookieValueFromHeader = (cookieHeader: string, cookieName: string): string | null => {
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    if (!cookie.startsWith(`${cookieName}=`)) {
      continue;
    }

    const cookieValue = cookie.slice(cookieName.length + 1);
    return cookieValue.length > 0 ? decode(cookieValue) : null;
  }

  return null;
};

/** The verified, unsigned Better Auth session token from a cookie store, or null. */
export const getSessionTokenFromCookieStore = (cookieStore: TCookieStore): string | null => {
  for (const cookieName of BETTER_AUTH_SESSION_COOKIE_NAMES) {
    const cookie = cookieStore.get(cookieName);
    if (cookie?.value) {
      return verifyAndExtractSessionToken(decode(cookie.value));
    }
  }

  return null;
};

/** The verified, unsigned Better Auth session token from a `Cookie` header, or null. */
export const getSessionTokenFromCookieHeader = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) {
    return null;
  }

  for (const cookieName of BETTER_AUTH_SESSION_COOKIE_NAMES) {
    const signedValue = getSignedCookieValueFromHeader(cookieHeader, cookieName);
    if (signedValue) {
      return verifyAndExtractSessionToken(signedValue);
    }
  }

  return null;
};
