import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { diagnoseOAuthStateCookie } from "./oauth-state-cookie-diagnosis";

// ENG-6692: Better Auth folds four causes into one `state_security_mismatch` ("State not persisted
// correctly"). These cases pin that the diagnosis tells them apart from the callback request alone.
//
// The signed value is built here with node:crypto rather than with Better Auth's own signer, so the
// expected format comes from an independent source: `<value>.<base64 HMAC-SHA256>`, URI-encoded
// (better-call `signCookieValue`). The real-signer round trip is pinned separately in
// `oauth-state-cookie-diagnosis.contract.test.ts`.
const SECRET = "eng-6692-test-secret-0123456789abcdef";
const OTHER_SECRET = "eng-6692-other-replica-secret-0123456789";
const COOKIE_NAME = "formbricks.state";
const cookie = { name: COOKIE_NAME, secret: SECRET };

const sign = (value: string, secret: string): string =>
  encodeURIComponent(`${value}.${createHmac("sha256", secret).update(value).digest("base64")}`);

const callback = (state: string | null, cookieHeader?: string): Request => {
  const url = new URL("https://app.test/api/auth/callback/google?code=irrelevant");
  if (state !== null) url.searchParams.set("state", state);
  return new Request(url, cookieHeader ? { headers: { cookie: cookieHeader } } : undefined);
};

describe("diagnoseOAuthStateCookie", () => {
  test("the cookie verifies and carries this callback's state", async () => {
    const request = callback("state-abc", `${COOKIE_NAME}=${sign("state-abc", SECRET)}`);

    await expect(diagnoseOAuthStateCookie(request, cookie)).resolves.toBe("matches");
  });

  test("no state cookie at all: expired, dropped or blocked by the browser", async () => {
    const request = callback("state-abc", "formbricks.session_token=unrelated");

    await expect(diagnoseOAuthStateCookie(request, cookie)).resolves.toBe("absent");
  });

  test("no cookie header at all reads as absent too", async () => {
    await expect(diagnoseOAuthStateCookie(callback("state-abc"), cookie)).resolves.toBe("absent");
  });

  test("signed with another secret: a replica whose AUTH_SECRET differs", async () => {
    const request = callback("state-abc", `${COOKIE_NAME}=${sign("state-abc", OTHER_SECRET)}`);

    await expect(diagnoseOAuthStateCookie(request, cookie)).resolves.toBe("signature_invalid");
  });

  test("a tampered or malformed value is not taken for a missing cookie", async () => {
    const tampered = sign("state-abc", SECRET).replace("state-abc", "state-xyz");

    await expect(
      diagnoseOAuthStateCookie(callback("state-abc", `${COOKIE_NAME}=${tampered}`), cookie)
    ).resolves.toBe("signature_invalid");
    await expect(
      diagnoseOAuthStateCookie(callback("state-abc", `${COOKIE_NAME}=no-signature-here`), cookie)
    ).resolves.toBe("signature_invalid");
  });

  test("verifies but holds another sign-in's state: a second flow in the same browser", async () => {
    const request = callback("state-abc", `${COOKIE_NAME}=${sign("state-newer-flow", SECRET)}`);

    await expect(diagnoseOAuthStateCookie(request, cookie)).resolves.toBe("state_differs");
  });

  test("reads the configured cookie name only, not a look-alike", async () => {
    const request = callback("state-abc", `__Secure-${COOKIE_NAME}=${sign("state-abc", SECRET)}`);

    await expect(diagnoseOAuthStateCookie(request, cookie)).resolves.toBe("absent");
    await expect(
      diagnoseOAuthStateCookie(request, { name: `__Secure-${COOKIE_NAME}`, secret: SECRET })
    ).resolves.toBe("matches");
  });

  test("says nothing about a request that carries no state", async () => {
    const request = callback(null, `${COOKIE_NAME}=${sign("state-abc", SECRET)}`);

    await expect(diagnoseOAuthStateCookie(request, cookie)).resolves.toBeUndefined();
  });
});
