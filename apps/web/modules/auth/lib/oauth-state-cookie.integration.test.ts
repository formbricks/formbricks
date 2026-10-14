import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";

/**
 * ENG-3314: an SSO sign-in that spends more than 5 minutes at the identity provider must still succeed.
 *
 * Better Auth 1.7 gives the OAuth state 10 minutes but its signed `state` cookie only 5, so a user slow at
 * the IdP came back to a valid state the callback refused anyway (`state_security_mismatch`). `auth.ts`
 * lifts the cookie through `advanced.cookies.state`. Driven through the real auth route, Postgres and
 * Redis, because the property lives in how Better Auth combines that override with its own default — and
 * a version bump can move either lifetime without touching our diff.
 *
 * `saml` is the provider under test because its endpoints are explicit URLs, so starting a sign-in makes
 * no outbound call. Time is moved with a fake `Date` only: it is what Better Auth checks the state's
 * `expiresAt` against, while Redis keeps its real TTL — the same as a real user arriving a few minutes
 * later. The token exchange is stubbed to fail, so reaching it is the proof that the state was accepted.
 */

// Registers the SAML generic provider: the config array is gated on ENTERPRISE_LICENSE_KEY, the provider
// on SAML_OAUTH_ENABLED (same setup as legacy-sso-callback.integration.test.ts).
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  ENTERPRISE_LICENSE_KEY: "integration-license",
  SAML_OAUTH_ENABLED: true,
}));

// The SSO license gate (`ssoLicenseGateBefore`) re-checks both features on every callback and would 403
// before state validation ran.
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsSsoEnabled: vi.fn(async () => true),
  getIsSamlSsoEnabled: vi.fn(async () => true),
}));

const BASE = "http://localhost:3000";
const SIGN_IN_STARTED_AT = new Date("2026-10-01T12:00:00.000Z");

interface TStartedSignIn {
  state: string;
  stateCookie: string;
  maxAgeSeconds: number;
}

/** The SAML button's request: `authClient.signIn.social({ provider: "saml", … })`. */
const startSignIn = async (): Promise<TStartedSignIn> => {
  const response = await POST(
    new Request(`${BASE}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ provider: "saml", callbackURL: "/", errorCallbackURL: "/auth/login" }),
    })
  );
  expect(response.status).toBe(200);

  const { url } = (await response.json()) as { url: string };
  const state = new URL(url).searchParams.get("state") ?? "";
  expect(state).not.toBe("");

  const setCookie = response.headers.getSetCookie().find((cookie) => /^[^=]*\.state=/.test(cookie));
  expect(setCookie).toBeDefined();
  const maxAge = /;\s*Max-Age=(\d+)/i.exec(setCookie ?? "");
  expect(maxAge).not.toBeNull();
  // The override must merge into the cookie's attributes, not replace them: the state cookie binds the
  // flow to this browser, so losing HttpOnly or SameSite would weaken the check it exists for. (Secure
  // comes from the same `defaultCookieAttributes` spread; it is off here only because the harness is http.)
  expect(setCookie).toMatch(/;\s*HttpOnly/i);
  expect(setCookie).toMatch(/;\s*SameSite=Lax/i);
  expect(setCookie).toMatch(/;\s*Path=\//i);

  return { state, stateCookie: (setCookie ?? "").split(";")[0], maxAgeSeconds: Number(maxAge?.[1]) };
};

/** The IdP's redirect back, at the pinned callback URL the provider is registered with. */
const returnFromIdp = async (state: string, cookie?: string) => {
  const response = await GET(
    new Request(`${BASE}/api/auth/oauth2/callback/saml?code=integration-code&state=${state}`, {
      headers: cookie ? { cookie } : {},
    })
  );
  const location = response.headers.get("location") ?? "";
  return { error: new URL(location, BASE).searchParams.get("error") };
};

const secondsAfterStart = (seconds: number) => {
  vi.setSystemTime(SIGN_IN_STARTED_AT.getTime() + seconds * 1000);
};

let tokenExchangeAttempts = 0;

beforeEach(() => {
  tokenExchangeAttempts = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SIGN_IN_STARTED_AT);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (requested.endsWith("/api/auth/saml/token")) {
      tokenExchangeAttempts += 1;
      throw new Error("token exchange is stubbed: reaching it means the state was accepted");
    }
    throw new Error(`unexpected outbound fetch: ${requested}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OAuth state cookie lifetime (ENG-3314)", () => {
  test("a sign-in that spends 7 minutes at the identity provider passes state validation", async () => {
    const { state, stateCookie, maxAgeSeconds } = await startSignIn();
    const dwellSeconds = 7 * 60;

    secondsAfterStart(dwellSeconds);
    // A browser sends the cookie only while it is inside its Max-Age, which is what failed before.
    const { error } = await returnFromIdp(state, dwellSeconds < maxAgeSeconds ? stateCookie : undefined);

    expect(error).not.toBe("state_mismatch");
    expect(tokenExchangeAttempts).toBe(1);
  });

  test("the cookie lives exactly as long as the state it guards", async () => {
    // Still valid one second before the cookie expires: the state does not die first.
    const early = await startSignIn();
    secondsAfterStart(early.maxAgeSeconds - 1);
    expect((await returnFromIdp(early.state, early.stateCookie)).error).not.toBe("state_mismatch");
    expect(tokenExchangeAttempts).toBe(1);

    // One second after, the state itself has expired, even with the cookie still presented: the
    // cookie does not outlive it either, so there is no window where one is valid and the other not.
    vi.setSystemTime(SIGN_IN_STARTED_AT);
    const late = await startSignIn();
    secondsAfterStart(late.maxAgeSeconds + 1);
    expect((await returnFromIdp(late.state, late.stateCookie)).error).toBe("state_mismatch");
    expect(tokenExchangeAttempts).toBe(1);
  });
});
