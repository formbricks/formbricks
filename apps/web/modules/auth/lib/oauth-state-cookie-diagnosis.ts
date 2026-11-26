/**
 * Which of Better Auth's four `state_security_mismatch` causes an OAuth callback hit (ENG-6692).
 *
 * On the database state strategy we run, Better Auth 1.7 rejects a callback with "State mismatch: State
 * not persisted correctly" whenever `getSignedCookie(state)` is falsy or differs from the `state` query
 * parameter (`better-auth/dist/state.mjs`, `parseGenericState`). better-call returns `null` for a missing
 * cookie and `false` for one whose HMAC does not verify, so four unrelated causes share one throw, one code
 * and one Sentry issue (FORMBRICKS-17B):
 *
 * | diagnosis | cause |
 * | --- | --- |
 * | `absent` | the cookie expired, or the browser dropped or blocked it |
 * | `signature_invalid` | the cookie does not verify with this server's secret: a replica whose `AUTH_SECRET` differs from the one that started the flow, or a tampered value |
 * | `state_differs` | the cookie verifies but carries another flow's state: a second sign-in in the same browser overwrote it, or a mixed-up callback |
 * | `matches` | the cookie is fine, so a `state_security_mismatch` came from the stored-record check instead |
 *
 * `signature_invalid` is the one that matters most: a secret split across replicas is a security-control
 * failure, not a sign-in annoyance, and until this diagnosis nothing separated it from the benign three.
 *
 * Re-implements better-call's read (`context.mjs` `getSignedCookie`, `crypto.mjs`) rather than importing it:
 * better-call is not a dependency of this app, only Better Auth's. The format is pinned against the real
 * signer by `oauth-state-cookie-diagnosis.contract.test.ts`, so an upstream change fails there.
 *
 * Returns only the label, never the cookie or the state: the state is a single-use credential for the
 * in-flight flow and has no business in a log line or a Sentry tag.
 */
export type TOAuthStateCookieDiagnosis = "absent" | "signature_invalid" | "state_differs" | "matches";

export interface OAuthStateCookie {
  /** The full cookie name Better Auth reads, prefix included, from `createAuthCookie("state")`. */
  name: string;
  /** The secret Better Auth signs and verifies the cookie with (`context.secret`). */
  secret: string;
}

/** better-call writes a base64 HMAC-SHA256: 32 bytes, so 44 characters ending in one `=`. */
const SIGNATURE_LENGTH = 44;

const readCookie = (cookieHeader: string | null, name: string): string | undefined => {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1 || pair.slice(0, separator).trim() !== name) continue;
    const raw = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
};

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> | undefined => {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
};

/** The signed value when its HMAC verifies with `secret`, `undefined` when it does not. */
const verifySignedValue = async (signed: string, secret: string): Promise<string | undefined> => {
  const separator = signed.lastIndexOf(".");
  if (separator < 1) return undefined;
  const value = signed.slice(0, separator);
  const signature = signed.slice(separator + 1);
  if (signature.length !== SIGNATURE_LENGTH || !signature.endsWith("=")) return undefined;
  const signatureBytes = decodeBase64(signature);
  if (!signatureBytes) return undefined;

  const algorithm = { name: "HMAC", hash: "SHA-256" };
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), algorithm, false, [
    "verify",
  ]);
  const verified = await crypto.subtle.verify(
    algorithm,
    key,
    signatureBytes,
    new TextEncoder().encode(value)
  );
  return verified ? value : undefined;
};

/**
 * Diagnose the state cookie a callback request carries, or `undefined` for a request with no `state`
 * parameter (not an OAuth callback, so there is nothing to diagnose).
 */
export const diagnoseOAuthStateCookie = async (
  request: Request,
  cookie: OAuthStateCookie
): Promise<TOAuthStateCookieDiagnosis | undefined> => {
  const state = new URL(request.url).searchParams.get("state");
  if (state === null) return undefined;

  const signed = readCookie(request.headers.get("cookie"), cookie.name);
  if (signed === undefined || signed === "") return "absent";

  const value = await verifySignedValue(signed, cookie.secret);
  if (value === undefined) return "signature_invalid";
  return value === state ? "matches" : "state_differs";
};
