import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { genericOAuth } from "better-auth/plugins";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * The upgrade guard for the pinned SSO callback URL (ENG-2343).
 *
 * Our three generic-OAuth providers set `redirectURI` so the callback URL stops tracking Better Auth's
 * routing — it has already moved twice (1.6's genericOAuth plugin mounted `/oauth2/callback/:providerId`;
 * 1.7 rebuilt the plugin onto the built-in `/callback/:id`), and each move otherwise forces every
 * self-hoster to re-register a redirect URI at their IdP, which OAuth requires to match exactly.
 *
 * That pin rests on an upstream option we do not control. Both the authorization request and the token
 * exchange resolve it as `options.redirectURI || redirectURI`, so if a future release drops or reorders
 * that precedence, Better Auth silently starts advertising its own default path again and every SSO
 * sign-in fails at the IdP with a redirect-URI mismatch — in production, on upgrade, with nothing in our
 * own diff to explain it. This asserts the behaviour against a REAL Better Auth instance so the failure
 * lands here instead.
 *
 * Deliberately not a unit test of our config (better-auth-providers.test.ts covers that) and deliberately
 * network-free: the provider is configured with explicit endpoint URLs rather than `discoveryUrl`, which
 * is the same shape the SAML bridge provider uses in production.
 */

const BASE_URL = "https://app.formbricks.test";
const PINNED_REDIRECT_URI = `${BASE_URL}/api/auth/oauth2/callback/pinned-provider`;
const IDP = "https://idp.formbricks.test";

const createAuthInstance = () =>
  betterAuth({
    baseURL: BASE_URL,
    secret: "better-auth-redirect-uri-pin-test-secret",
    // memoryAdapter does not create models lazily, so every model the sign-in touches is declared here.
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "pinned-provider",
            clientId: "pinned-client",
            clientSecret: "pinned-secret",
            authorizationUrl: `${IDP}/authorize`,
            tokenUrl: `${IDP}/token`,
            userInfoUrl: `${IDP}/userinfo`,
            scopes: ["openid", "email", "profile"],
            pkce: true,
            redirectURI: PINNED_REDIRECT_URI,
          },
        ],
      }),
    ],
  });

const getAuthorizationUrl = async (): Promise<URL> => {
  const auth = createAuthInstance();
  // `signInSocial`, not a genericOAuth endpoint: in 1.7 the plugin registers no routes of its own, it
  // only appends its providers into `ctx.socialProviders`. That is the whole reason the callback path
  // moved, so driving the core endpoint is what exercises the real production path.
  const response = await auth.api.signInSocial({
    body: { provider: "pinned-provider", callbackURL: "/" },
  });
  return new URL((response as { url: string }).url);
};

describe("Better Auth honours the pinned SSO redirect URI", () => {
  test("sends our redirectURI to the IdP rather than its own callback path", async () => {
    const authorizationUrl = await getAuthorizationUrl();

    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe(`${IDP}/authorize`);
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(PINNED_REDIRECT_URI);
  });

  /**
   * The specific regression to catch. Better Auth's own default is `/api/auth/callback/{providerId}`,
   * which is what a dropped `redirectURI` would fall back to — asserting the absence of that string is
   * what distinguishes "the option was honoured" from "the option happened to match the default".
   */
  test("never falls back to the version default callback path", async () => {
    const authorizationUrl = await getAuthorizationUrl();
    const redirectUri = authorizationUrl.searchParams.get("redirect_uri") ?? "";

    expect(redirectUri).toContain("/api/auth/oauth2/callback/");
    expect(redirectUri).not.toBe(`${BASE_URL}/api/auth/callback/pinned-provider`);
  });
});

/**
 * The other half of the pin, and the one that fails in production if it regresses.
 *
 * `options.redirectURI || redirectURI` is resolved TWICE by upstream — once building the authorization
 * URL (`create-authorization-url.mjs`) and once building the token request
 * (`validate-authorization-code.mjs`). The tests above only drive the first. If a release kept the option
 * on the authorization leg and dropped it on the token leg, they would all stay green while every SSO
 * sign-in died at the identity provider's token endpoint with a `redirect_uri` mismatch — the two legs
 * MUST send the same value, and that is what this asserts.
 *
 * Driven as a real two-leg flow against one instance so the `state` verification row and its signed
 * cookie are the genuine ones: sign-in through `auth.handler` to get the state + cookie, then the
 * callback with both, with `fetch` stubbed at the IdP boundary to capture what was posted.
 */
describe("Better Auth sends the pinned redirect URI on the token leg too", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("the token request carries the same redirect_uri as the authorization request", async () => {
    const auth = createAuthInstance();

    const signIn = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ provider: "pinned-provider", callbackURL: "/" }),
      })
    );
    expect(signIn.status).toBe(200);

    const { url: authorizationUrl } = (await signIn.json()) as { url: string };
    const authorizationRedirectUri = new URL(authorizationUrl).searchParams.get("redirect_uri");
    const state = new URL(authorizationUrl).searchParams.get("state") ?? "";
    expect(state).not.toBe("");

    // The signed state cookie Better Auth just issued; the callback rejects the state without it.
    const cookie = (signIn.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0]).join("; ");
    expect(cookie).not.toBe("");

    let tokenRedirectUri: string | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (requested.startsWith(`${IDP}/token`)) {
        // `redirect_uri` is form-encoded in the token request body — the value under test.
        tokenRedirectUri = new URLSearchParams(String(init?.body ?? "")).get("redirect_uri");
        return Response.json({
          access_token: "pinned-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "openid email profile",
        });
      }
      if (requested.startsWith(`${IDP}/userinfo`)) {
        return Response.json({
          sub: "pinned-subject",
          email: "pinned@formbricks.test",
          email_verified: true,
          name: "Pinned Person",
        });
      }
      throw new Error(`unexpected outbound fetch: ${requested}`);
    });

    await auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/pinned-provider?code=pinned-code&state=${state}`, {
        headers: { cookie },
      })
    );

    expect(tokenRedirectUri).toBe(PINNED_REDIRECT_URI);
    // Both legs agree, which is the property the pin depends on.
    expect(tokenRedirectUri).toBe(authorizationRedirectUri);
  });
});
