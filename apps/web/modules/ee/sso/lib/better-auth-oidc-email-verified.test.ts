import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * ENG-2589 — the generic-OIDC half, proven end to end against a REAL Better Auth instance.
 *
 * The unit tests around `mapProfileToUser` show the mapper returns the right value; they cannot show
 * that the value SURVIVES. Better Auth resolves a generic-OAuth profile through
 * `emailVerified: userInfo.data.email_verified ?? false` before any database hook runs, and only the
 * mapper's return spreading last keeps our answer authoritative — an upstream reorder, or a release
 * that stops calling the mapper on this path, would silently restore the coalesced value and hand a
 * verified account to an IdP-unverified address. That is the regression this file exists to catch.
 *
 * The flow is driven with **no `id_token` in the token response**, deliberately: that is what forces
 * the userinfo branch, which is the one carrying the `?? false`. The discovery document omits
 * `jwks_uri` for the same reason it is omitted in the SSO smoke recipe — with one present, Better Auth
 * builds an id_token verification config and the flow would need a signed token to get anywhere.
 */
const BASE_URL = "https://app.formbricks.test";
const IDP = "https://idp.formbricks.test";

const { captureSsoIdentity } = vi.hoisted(() => ({ captureSsoIdentity: vi.fn() }));
const { runWithSsoRequestContext } = await import("./sso-request-context");
vi.mock("./sso-request-context", async () => {
  const actual = await vi.importActual<typeof import("./sso-request-context")>("./sso-request-context");
  return { ...actual, captureSsoIdentity };
});

// The SSO gate and the membership writes are exercised by their own suites; here they must simply
// allow the sign-up so the row reaches the database, which is what this file asserts on.
vi.mock("./sso-provisioning", () => ({
  gateSsoProvisioning: vi.fn(async () => ({
    action: "provision",
    organizationId: "org-1",
    assignToDefaultTeam: false,
    signupSource: "direct",
  })),
  provisionSsoUserMemberships: vi.fn(),
}));
vi.mock("./sso-recovery", () => ({ startSsoRecovery: vi.fn() }));
vi.mock("@formbricks/database", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/posthog", () => ({ identifyPostHogPerson: vi.fn() }));
vi.mock("@/lib/utils/locale", () => ({ findMatchingLocale: vi.fn(async () => "en-US") }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventBackground: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => new Map()) }));

vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<{ env: Record<string, unknown> }>("@/lib/env");
  return { env: { ...actual.env, BETTER_AUTH_URL: BASE_URL } };
});

/** The openid provider is built at import time from the constants, so they are mocked before import. */
const loadOidcProvider = async () => {
  vi.resetModules();
  vi.doMock("@/lib/constants", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@/lib/constants");
    return {
      ...actual,
      ENTERPRISE_LICENSE_KEY: "lic",
      WEBAPP_URL: BASE_URL,
      GITHUB_OAUTH_ENABLED: false,
      GOOGLE_OAUTH_ENABLED: false,
      AZURE_OAUTH_ENABLED: false,
      SAML_OAUTH_ENABLED: false,
      OIDC_OAUTH_ENABLED: true,
      OIDC_CLIENT_ID: "oidc-id",
      OIDC_CLIENT_SECRET: "oidc-secret",
      OIDC_ISSUER: IDP,
    };
  });
  const providers = await import("./better-auth-providers");
  const hooks = await import("./better-auth-hooks");
  return { ssoGenericOAuthConfig: providers.ssoGenericOAuthConfig, ssoDatabaseHooks: hooks.ssoDatabaseHooks };
};

/**
 * Every outbound call the flow makes, stubbed at the IdP boundary. `emailVerified` is what the IdP
 * asserts on its userinfo response — the value under test; `undefined` omits the claim entirely.
 */
const stubIdp = (emailVerified: boolean | undefined) => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.startsWith(`${IDP}/.well-known/openid-configuration`)) {
      // No `jwks_uri`: keeps Better Auth off the id_token verification path (see the file docblock).
      return Response.json({
        issuer: IDP,
        authorization_endpoint: `${IDP}/authorize`,
        token_endpoint: `${IDP}/token`,
        userinfo_endpoint: `${IDP}/userinfo`,
      });
    }
    if (url.startsWith(`${IDP}/token`)) {
      // No `id_token`, so identity must come from userinfo — the branch that coalesces the claim.
      return Response.json({ access_token: "oidc-access-token", token_type: "Bearer", expires_in: 3600 });
    }
    if (url.startsWith(`${IDP}/userinfo`)) {
      return Response.json({
        sub: "oidc-subject",
        email: "squatter@corp.test",
        name: "Squatter",
        ...(emailVerified === undefined ? {} : { email_verified: emailVerified }),
      });
    }
    throw new Error(`unexpected outbound fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const signUpThroughOidc = async (emailVerified: boolean | undefined) => {
  stubIdp(emailVerified);
  const { ssoGenericOAuthConfig, ssoDatabaseHooks } = await loadOidcProvider();
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  const { genericOAuth } = await import("better-auth/plugins");

  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: "eng-2589-oidc-email-verified-boundary-secret",
    database: memoryAdapter(db),
    user: {
      additionalFields: {
        identityProvider: { type: "string", required: false, input: false },
        identityProviderAccountId: { type: "string", required: false, input: false },
      },
    },
    plugins: [genericOAuth({ config: ssoGenericOAuthConfig })],
    databaseHooks: ssoDatabaseHooks,
  });

  // Leg 1 — the authorization request, for the real state row and its signed cookie.
  const signIn = await auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ provider: "openid", callbackURL: "/" }),
    })
  );
  expect(signIn.status).toBe(200);
  const { url } = (await signIn.json()) as { url: string };
  const state = new URL(url).searchParams.get("state") ?? "";
  expect(state).not.toBe("");
  const cookie = (signIn.headers.getSetCookie?.() ?? []).map((v) => v.split(";")[0]).join("; ");

  // Leg 2 — the callback, which runs the mapper, the coalesce, and our database hook in the real order.
  await runWithSsoRequestContext(() =>
    auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/openid?code=oidc-code&state=${state}`, {
        headers: { cookie },
      })
    )
  );

  // Anchor the flow: a rejected callback leaves `db.user` empty, and a bare assertion on `undefined`
  // would blame the claim for what was really a broken stub.
  expect(db.user).toHaveLength(1);
  return db.user[0];
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/constants");
});

describe("generic OIDC sign-up persists the IdP's email_verified claim (real Better Auth, ENG-2589)", () => {
  test("an IdP that asserts the address is unverified must not mint a verified account", async () => {
    const user = await signUpThroughOidc(false);
    expect(user).toMatchObject({ email: "squatter@corp.test", emailVerified: false });
  });

  test("an IdP that attests the address keeps it verified", async () => {
    const user = await signUpThroughOidc(true);
    expect(user).toMatchObject({ email: "squatter@corp.test", emailVerified: true });
  });

  /**
   * The upgrade-safety guarantee, and the reason the fix is not simply "honour the value Better Auth
   * gives us". An IdP that never sends the claim must keep producing verified users, or every
   * self-hoster whose provider omits it gets a fleet of unverified accounts on upgrade. Upstream's
   * `?? false` makes this case indistinguishable from the asserted-false one above — that these two
   * tests disagree is the whole point of reading the raw claim.
   */
  test("an IdP that never sends the claim still produces a verified account", async () => {
    const user = await signUpThroughOidc(undefined);
    expect(user).toMatchObject({ email: "squatter@corp.test", emailVerified: true });
  });
});
