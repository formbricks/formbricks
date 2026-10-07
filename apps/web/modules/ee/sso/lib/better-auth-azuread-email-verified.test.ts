import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * ENG-2589 — the Entra half, driven through a REAL Better Auth instance.
 *
 * Azure is the provider whose classification is easiest to get wrong, because Microsoft does not speak
 * `email_verified` at all: neither its id_tokens nor Graph's `/oidc/userinfo` carry it. Our mapper falls
 * back to `xms_edov`, Microsoft's own "is this address proven" claim — and the whole chain that has to
 * hold for that to matter is long: Graph's response has to reach `mapProfileToUser` with the raw claim
 * intact (it survives only via a spread in `microsoftGraphUserInfo`), the mapper's return has to win
 * over Better Auth's own `emailVerified`, and the sign-up hook has to pass it through rather than
 * forcing `true`. A unit test on the mapper proves one link of that; this proves the row.
 *
 * Both Azure branches are covered, because they resolve identity in completely different ways:
 *  - `common` / unset — the documented default: explicit endpoints, no discovery, identity from Graph.
 *  - a concrete tenant: discovery, and identity from the id_token claims.
 */
const BASE_URL = "https://app.formbricks.test";
const GRAPH = "https://graph.microsoft.com/oidc/userinfo";

const { captureSsoIdentity } = vi.hoisted(() => ({ captureSsoIdentity: vi.fn() }));
const { runWithSsoRequestContext } = await import("./sso-request-context");
vi.mock("./sso-request-context", async () => {
  const actual = await vi.importActual<typeof import("./sso-request-context")>("./sso-request-context");
  return { ...actual, captureSsoIdentity };
});

// The gate and the membership writes have their own suites; here they must only let the sign-up reach
// the database, which is what this file asserts on.
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
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: vi.fn(async () => undefined),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => new Map()) }));
vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<{ env: Record<string, unknown> }>("@/lib/env");
  return { env: { ...actual.env, BETTER_AUTH_URL: BASE_URL } };
});

const loadAzure = async (tenant?: string) => {
  vi.resetModules();
  vi.doMock("@/lib/constants", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@/lib/constants");
    return {
      ...actual,
      ENTERPRISE_LICENSE_KEY: "lic",
      WEBAPP_URL: BASE_URL,
      GITHUB_OAUTH_ENABLED: false,
      GOOGLE_OAUTH_ENABLED: false,
      OIDC_OAUTH_ENABLED: false,
      SAML_OAUTH_ENABLED: false,
      AZURE_OAUTH_ENABLED: true,
      AZUREAD_CLIENT_ID: "az-client",
      AZUREAD_CLIENT_SECRET: "az-secret",
      AZUREAD_TENANT_ID: tenant,
    };
  });
  const providers = await import("./better-auth-providers");
  const hooks = await import("./better-auth-hooks");
  return { config: providers.ssoGenericOAuthConfig, hooks: hooks.ssoDatabaseHooks };
};

/** The Entra profile under test. `undefined` omits the claim, which is the default-tenant reality. */
const buildProfile = (email: string, xmsEdov: boolean | undefined) => ({
  sub: `sub-${email}`,
  email,
  name: "Entra User",
  ...(xmsEdov === undefined ? {} : { xms_edov: xmsEdov }),
});

/** An UNSIGNED id_token, for the concrete-tenant branch where identity comes from its claims. */
const idTokenFor = (profile: Record<string, unknown>) =>
  `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(
    JSON.stringify(profile)
  ).toString("base64url")}.`;

const signUpThroughAzure = async ({
  tenant,
  email,
  xmsEdov,
}: {
  tenant?: string;
  email: string;
  xmsEdov: boolean | undefined;
}) => {
  const profile = buildProfile(email, xmsEdov);
  const usesDiscovery = Boolean(tenant && !["common", "organizations"].includes(tenant));

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      // Discovery, only reached on the concrete-tenant branch. No `jwks_uri`: with one present Better
      // Auth would demand a verifiable id_token signature, which a stub cannot produce.
      if (url.includes("/.well-known/openid-configuration")) {
        const authority = `https://login.microsoftonline.com/${tenant}`;
        return Response.json({
          issuer: `${authority}/v2.0`,
          authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
          token_endpoint: `${authority}/oauth2/v2.0/token`,
          userinfo_endpoint: GRAPH,
        });
      }
      if (url.includes("/oauth2/v2.0/token")) {
        return Response.json({
          access_token: "az-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          // Only the discovery branch reads identity from the token; the Graph override ignores it.
          ...(usesDiscovery ? { id_token: idTokenFor(profile) } : {}),
        });
      }
      if (url.startsWith(GRAPH)) return Response.json(profile);
      throw new Error(`unexpected outbound fetch: ${url}`);
    })
  );

  const { config, hooks } = await loadAzure(tenant);
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
    secret: "eng-2589-azuread-email-verified-secret",
    database: memoryAdapter(db),
    user: {
      additionalFields: {
        identityProvider: { type: "string", required: false, input: false },
        identityProviderAccountId: { type: "string", required: false, input: false },
      },
    },
    plugins: [genericOAuth({ config })],
    databaseHooks: hooks,
  });

  const signIn = await auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ provider: "azuread", callbackURL: "/" }),
    })
  );
  expect(signIn.status).toBe(200);
  const { url } = (await signIn.json()) as { url: string };
  const state = new URL(url).searchParams.get("state") ?? "";
  expect(state).not.toBe("");
  const cookie = (signIn.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

  // Entra's redirect back, replayed directly — it is only a browser redirect, and its host is not ours.
  await runWithSsoRequestContext(() =>
    auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/azuread?code=az-code&state=${state}`, {
        headers: { cookie },
      })
    )
  );

  expect(db.user, "the callback did not create a user — the stub is wrong, not the claim").toHaveLength(1);
  return db.user[0];
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/constants");
});

describe("Entra sign-up honours xms_edov (real Better Auth, ENG-2589)", () => {
  // `common` is the documented default and what an unset AZUREAD_TENANT_ID resolves to, so it is the
  // configuration most self-hosters actually run. Identity comes from Graph here, not the id_token.
  describe.each([
    { tenant: undefined, label: "unset" },
    { tenant: "common", label: "common" },
  ])("multi-tenant authority ($label) — identity from Graph", ({ tenant, label }) => {
    test("an address Entra says is NOT domain-verified does not become a verified account", async () => {
      const user = await signUpThroughAzure({ tenant, email: `denied-${label}@corp.test`, xmsEdov: false });
      expect(user).toMatchObject({ emailVerified: false, identityProvider: "azuread" });
    });

    test("an address Entra vouches for stays verified", async () => {
      const user = await signUpThroughAzure({ tenant, email: `ok-${label}@corp.test`, xmsEdov: true });
      expect(user).toMatchObject({ emailVerified: true, identityProvider: "azuread" });
    });

    /**
     * The upgrade-safety case, and the common one in the wild: `xms_edov` is an OPTIONAL claim a tenant
     * has to switch on, so most Entra deployments send neither it nor `email_verified`. Those must keep
     * producing verified users exactly as they did before this change.
     */
    test("a tenant that enables no verification claim is unchanged", async () => {
      const user = await signUpThroughAzure({
        tenant,
        email: `quiet-${label}@corp.test`,
        xmsEdov: undefined,
      });
      expect(user).toMatchObject({ emailVerified: true, identityProvider: "azuread" });
    });
  });

  // A concrete tenant takes the discovery branch instead, where identity is read from the id_token's
  // claims rather than Graph — a different code path that must reach the same answer.
  describe("concrete tenant — identity from the id_token", () => {
    const tenant = "00000000-1111-2222-3333-444444444444";

    test("a denied xms_edov is honoured on the discovery branch too", async () => {
      const user = await signUpThroughAzure({ tenant, email: "denied-tenant@corp.test", xmsEdov: false });
      expect(user).toMatchObject({ emailVerified: false, identityProvider: "azuread" });
    });

    test("an absent claim still verifies on the discovery branch", async () => {
      const user = await signUpThroughAzure({ tenant, email: "quiet-tenant@corp.test", xmsEdov: undefined });
      expect(user).toMatchObject({ emailVerified: true, identityProvider: "azuread" });
    });
  });
});
