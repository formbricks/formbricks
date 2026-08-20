import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PINNED_SSO_PROVIDER_IDS } from "@/modules/auth/lib/legacy-sso-callback";

// captureSsoIdentity is request-scoped (server-only AsyncLocalStorage); stub it so the mappers run in
// isolation and we can assert the identity each provider captures.
const { captureSsoIdentity } = vi.hoisted(() => ({ captureSsoIdentity: vi.fn() }));
vi.mock("./sso-request-context", () => ({ captureSsoIdentity }));

// The pinned SSO callback URL is built from `getAuthIssuerUrl()`, which reads `@/lib/env` directly rather
// than the constants mocked below — it has to, because that helper encodes Better Auth's own base-URL
// precedence (`BETTER_AUTH_URL ?? NEXTAUTH_URL ?? WEBAPP_URL`). Spread the real env so `@/lib/constants`
// still validates, and pin only the auth URL so the expected callback URL is deterministic.
vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<{ env: Record<string, unknown> }>("@/lib/env");
  return { env: { ...actual.env, BETTER_AUTH_URL: "https://app.formbricks.test" } };
});

// The module computes ssoSocialProviders / ssoGenericOAuthConfig at IMPORT time from `@/lib/constants`,
// so each scenario re-mocks the constants and re-imports. We spread the REAL module so the two hardcoded
// SAML literals (SAML_TENANT/SAML_PRODUCT) keep their real values — they are not env-derived toggles and
// can't be overridden through the mock anyway — and override only the env-driven flags/credentials.
interface MockConstants {
  ENTERPRISE_LICENSE_KEY?: string;
  GITHUB_OAUTH_ENABLED: boolean;
  GITHUB_ID?: string;
  GITHUB_SECRET?: string;
  GOOGLE_OAUTH_ENABLED: boolean;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AZURE_OAUTH_ENABLED: boolean;
  AZUREAD_CLIENT_ID?: string;
  AZUREAD_CLIENT_SECRET?: string;
  AZUREAD_TENANT_ID?: string;
  OIDC_OAUTH_ENABLED: boolean;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  OIDC_ISSUER?: string;
  SAML_OAUTH_ENABLED: boolean;
  WEBAPP_URL: string;
}

// Deterministic defaults for the env-derived toggles/credentials (so the suite doesn't depend on the
// runner's .env): everything off, no license, a known WEBAPP_URL. Spread OVER the real constants per
// test so non-overridden values (e.g. the hardcoded SAML_TENANT/SAML_PRODUCT) keep their real values.
const BASE: MockConstants = {
  ENTERPRISE_LICENSE_KEY: undefined,
  GITHUB_OAUTH_ENABLED: false,
  GITHUB_ID: undefined,
  GITHUB_SECRET: undefined,
  GOOGLE_OAUTH_ENABLED: false,
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  AZURE_OAUTH_ENABLED: false,
  AZUREAD_CLIENT_ID: undefined,
  AZUREAD_CLIENT_SECRET: undefined,
  AZUREAD_TENANT_ID: undefined,
  OIDC_OAUTH_ENABLED: false,
  OIDC_CLIENT_ID: undefined,
  OIDC_CLIENT_SECRET: undefined,
  OIDC_ISSUER: undefined,
  SAML_OAUTH_ENABLED: false,
  WEBAPP_URL: "https://app.formbricks.test",
};

const loadProviders = async (overrides: Partial<MockConstants> = {}) => {
  vi.resetModules();
  vi.doMock("@/lib/constants", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@/lib/constants");
    return { ...actual, ...BASE, ...overrides };
  });
  return import("./better-auth-providers");
};

// Social-provider entries are a union (config | factory); at runtime they're the config object.
interface SocialEntry {
  clientId: string;
  clientSecret: string;
  mapProfileToUser: unknown;
}
const asSocial = (providers: unknown) => providers as Record<string, SocialEntry | undefined>;

// Invoke a `mapProfileToUser` mapper without dragging in Better Auth's per-provider profile types.
const callMapper = (mapper: unknown, profile: Record<string, unknown>): { email?: string; name?: string } =>
  (mapper as (p: Record<string, unknown>) => { email?: string; name?: string })(profile);

beforeEach(() => {
  captureSsoIdentity.mockClear();
});

afterEach(() => {
  vi.doUnmock("@/lib/constants");
});

describe("better-auth SSO providers", () => {
  describe("enterprise license gate", () => {
    test("registers no providers without an enterprise license", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: undefined,
        GITHUB_OAUTH_ENABLED: true,
        GOOGLE_OAUTH_ENABLED: true,
        AZURE_OAUTH_ENABLED: true,
        OIDC_OAUTH_ENABLED: true,
        SAML_OAUTH_ENABLED: true,
      });
      expect(m.ssoSocialProviders).toEqual({});
      expect(m.ssoGenericOAuthConfig).toEqual([]);
    });

    test("registers no providers when licensed but every provider is disabled", async () => {
      const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic" });
      expect(m.ssoSocialProviders).toEqual({});
      expect(m.ssoGenericOAuthConfig).toEqual([]);
    });
  });

  describe("social providers (Google / GitHub)", () => {
    test("registers GitHub and Google with their configured credentials", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        GITHUB_OAUTH_ENABLED: true,
        GITHUB_ID: "gh-id",
        GITHUB_SECRET: "gh-secret",
        GOOGLE_OAUTH_ENABLED: true,
        GOOGLE_CLIENT_ID: "g-id",
        GOOGLE_CLIENT_SECRET: "g-secret",
      });
      const social = asSocial(m.ssoSocialProviders);
      expect(social.github).toMatchObject({ clientId: "gh-id", clientSecret: "gh-secret" });
      expect(social.google).toMatchObject({ clientId: "g-id", clientSecret: "g-secret" });
    });

    test("falls back to empty-string credentials when env values are unset", async () => {
      const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic", GITHUB_OAUTH_ENABLED: true });
      const social = asSocial(m.ssoSocialProviders);
      expect(social.github).toMatchObject({ clientId: "", clientSecret: "" });
      expect(social.google).toBeUndefined();
    });

    test("GitHub mapProfileToUser captures the identity (id stringified) and returns the email", async () => {
      const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic", GITHUB_OAUTH_ENABLED: true });
      const social = asSocial(m.ssoSocialProviders);
      const result = callMapper(social.github?.mapProfileToUser, { email: "octocat@github.test", id: 42 });
      expect(result).toEqual({ email: "octocat@github.test" });
      expect(captureSsoIdentity).toHaveBeenCalledWith({
        email: "octocat@github.test",
        providerAccountId: "42",
      });
    });

    test("Google mapProfileToUser captures the identity using the OIDC sub", async () => {
      const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic", GOOGLE_OAUTH_ENABLED: true });
      const social = asSocial(m.ssoSocialProviders);
      const result = callMapper(social.google?.mapProfileToUser, {
        email: "user@gmail.test",
        sub: "google-sub-123",
      });
      expect(result).toEqual({ email: "user@gmail.test" });
      expect(captureSsoIdentity).toHaveBeenCalledWith({
        email: "user@gmail.test",
        providerAccountId: "google-sub-123",
      });
    });
  });

  describe("generic-OAuth providers (Azure / OIDC / SAML)", () => {
    test("Azure keeps providerId 'azuread' and builds the tenant discovery URL", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        AZUREAD_CLIENT_ID: "az-id",
        AZUREAD_CLIENT_SECRET: "az-secret",
        AZUREAD_TENANT_ID: "tenant-123",
      });
      const azure = m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread");
      if (!azure) throw new Error("azuread provider not registered");
      expect(azure).toMatchObject({ clientId: "az-id", clientSecret: "az-secret", pkce: true });
      expect(azure.discoveryUrl).toBe(
        "https://login.microsoftonline.com/tenant-123/v2.0/.well-known/openid-configuration"
      );
      expect(azure.scopes).toEqual(["openid", "email", "profile"]);
      // ENG-1800 no longer needs an opt-out: Better Auth 1.7 only compares the RFC 9207 response
      // `iss` when the provider actually sends one, and Entra never does, so the check that produced
      // `error=issuer_missing` cannot fire. What replaces it as the load-bearing invariant is the
      // pinned account issuer below.
      expect(azure).not.toHaveProperty("requireIssuerValidation");
      expect(azure.accountIssuer).toBe("local:oauth:azuread");
    });

    /**
     * The account-identity contract with the database migration (ENG-2343).
     *
     * Better Auth 1.7 keys accounts on (issuer, accountId). Left unpinned, a provider with a
     * discoveryUrl adopts the DISCOVERED issuer — tenant-specific, so different on every install and
     * impossible to reproduce in a portable backfill. These values must stay byte-identical to what
     * migration 20260812110000 writes into Account.issuer, or existing SSO users stop matching at
     * sign-in and are pushed into account recovery.
     */
    test("pins a portable account issuer on every generic provider", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        OIDC_OAUTH_ENABLED: true,
        SAML_OAUTH_ENABLED: true,
      });

      expect(m.ssoGenericOAuthConfig.map((c) => [c.providerId, c.accountIssuer])).toEqual([
        ["azuread", "local:oauth:azuread"],
        ["openid", "local:oauth:openid"],
        ["saml", "local:oauth:saml"],
      ]);
    });

    /**
     * The callback URL is a registered value at every customer IdP, and OAuth requires it to match
     * EXACTLY (RFC 6749 §3.1.2.2, no wildcards) — so letting it track Better Auth's routing means every
     * self-hoster edits every IdP whenever upstream moves the route. It has already moved twice: the 1.6
     * genericOAuth plugin mounted `/oauth2/callback/:providerId`, and 1.7 rebuilt the plugin onto the
     * built-in `/callback/:id`. This pins the v5.2 URL that is already registered everywhere.
     *
     * The URL alone is not enough — see legacy-sso-callback.ts for the half that serves it, and
     * better-auth-redirect-uri-pin.test.ts for the guard that Better Auth still honours the option.
     */
    test("pins the v5.2 callback URL on every generic provider", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        OIDC_OAUTH_ENABLED: true,
        SAML_OAUTH_ENABLED: true,
      });

      expect(m.ssoGenericOAuthConfig.map((c) => [c.providerId, c.redirectURI])).toEqual([
        ["azuread", "https://app.formbricks.test/api/auth/oauth2/callback/azuread"],
        ["openid", "https://app.formbricks.test/api/auth/oauth2/callback/openid"],
        ["saml", "https://app.formbricks.test/api/auth/oauth2/callback/saml"],
      ]);
    });

    /**
     * Drift guard for the two halves of the pin. `legacy-sso-callback.ts` keeps its own id literal
     * because it must work on an unlicensed instance, where this config list is empty — so nothing but
     * this assertion stops the two from diverging. A provider pinned here but missing there advertises a
     * URL no route serves: a 404 on every sign-in with that provider.
     */
    test("every pinned provider is one the legacy callback route serves", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        OIDC_OAUTH_ENABLED: true,
        SAML_OAUTH_ENABLED: true,
      });

      const pinned = m.ssoGenericOAuthConfig
        .filter((c) => c.redirectURI?.includes("/api/auth/oauth2/callback/"))
        .map((c) => c.providerId);

      expect(pinned).toEqual([...PINNED_SSO_PROVIDER_IDS]);
    });

    /**
     * The multi-tenant case must NOT use discovery (ENG-2343). Microsoft's `common` discovery document
     * advertises `issuer: "https://login.microsoftonline.com/{tenantid}/v2.0"` — a documented template,
     * verified against the live endpoint — and Better Auth 1.7 compares `iss` for literal equality
     * whenever discovery yields both `issuer` and `jwks_uri`. Every real id_token carries the tenant
     * GUID, so discovery here would reject every Azure sign-in. Explicit endpoints build no
     * `idTokenConfig` at all, which restores the 1.6 UserInfo path.
     */
    test("Azure uses explicit endpoints, not discovery, when no tenant is configured", async () => {
      const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic", AZURE_OAUTH_ENABLED: true });
      const azure = m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread");

      expect(azure?.discoveryUrl).toBeUndefined();
      expect(azure?.authorizationUrl).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      expect(azure?.tokenUrl).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/token");
      expect(azure?.userInfoUrl).toBe("https://graph.microsoft.com/oidc/userinfo");
      expect(azure?.accountIssuer).toBe("local:oauth:azuread");
    });

    /**
     * The single-tenant case keeps discovery, so the id_token IS verified against a concrete issuer —
     * strictly stronger than 1.6. This pairing is the whole point of the split: no self-hoster has to
     * change anything, and those who can have the stronger check get it.
     */
    test("Azure uses discovery when a concrete tenant is configured", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        AZUREAD_TENANT_ID: "00000000-1111-2222-3333-444444444444",
      });
      const azure = m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread");

      expect(azure?.discoveryUrl).toBe(
        "https://login.microsoftonline.com/00000000-1111-2222-3333-444444444444/v2.0/.well-known/openid-configuration"
      );
      expect(azure?.authorizationUrl).toBeUndefined();
      expect(azure?.tokenUrl).toBeUndefined();
    });

    test("Azure mapProfileToUser resolves the display name through its fallback chain", async () => {
      const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic", AZURE_OAUTH_ENABLED: true });
      const azure = m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread");
      const mapper = azure?.mapProfileToUser;

      expect(callMapper(mapper, { email: "a@az.test", sub: "az-sub", name: "Ada Lovelace" })).toEqual({
        email: "a@az.test",
        name: "Ada Lovelace",
      });
      expect(captureSsoIdentity).toHaveBeenLastCalledWith({
        email: "a@az.test",
        providerAccountId: "az-sub",
      });

      expect(
        callMapper(mapper, { email: "b@az.test", sub: "s", given_name: "Grace", family_name: "Hopper" })
      ).toEqual({ email: "b@az.test", name: "Grace Hopper" });

      expect(callMapper(mapper, { email: "c@az.test", sub: "s", preferred_username: "charles" })).toEqual({
        email: "c@az.test",
        name: "charles",
      });
    });

    test("OIDC registers with issuer validation and builds the discovery URL from the issuer", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        OIDC_OAUTH_ENABLED: true,
        OIDC_CLIENT_ID: "oidc-id",
        OIDC_CLIENT_SECRET: "oidc-secret",
        OIDC_ISSUER: "https://idp.test",
      });
      const oidc = m.ssoGenericOAuthConfig.find((c) => c.providerId === "openid");
      if (!oidc) throw new Error("openid provider not registered");
      expect(oidc).toMatchObject({
        clientId: "oidc-id",
        clientSecret: "oidc-secret",
        pkce: true,
        // Issuer validation is automatic in 1.7 for providers that return `iss`, so the flag is gone.
        accountIssuer: "local:oauth:openid",
      });
      expect(oidc.discoveryUrl).toBe("https://idp.test/.well-known/openid-configuration");
      expect(
        callMapper(oidc.mapProfileToUser, { email: "d@idp.test", sub: "oidc-sub", name: "Dee" })
      ).toEqual({
        email: "d@idp.test",
        name: "Dee",
      });
      expect(captureSsoIdentity).toHaveBeenLastCalledWith({
        email: "d@idp.test",
        providerAccountId: "oidc-sub",
      });
    });

    test("SAML bridges to the local Jackson endpoints and resolves first/last name", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        SAML_OAUTH_ENABLED: true,
        WEBAPP_URL: "https://app.formbricks.test",
      });
      const saml = m.ssoGenericOAuthConfig.find((c) => c.providerId === "saml");
      if (!saml) throw new Error("saml provider not registered");
      expect(saml).toMatchObject({
        clientId: "dummy",
        clientSecret: "dummy",
        pkce: true,
        authorizationUrl: "https://app.formbricks.test/api/auth/saml/authorize",
        tokenUrl: "https://app.formbricks.test/api/auth/saml/token",
        userInfoUrl: "https://app.formbricks.test/api/auth/saml/userinfo",
      });
      // authorizationUrlParams also carries the hardcoded SAML_TENANT/SAML_PRODUCT constants. Vitest's
      // module mock surfaces those primitive `const` exports as undefined in unit tests (they resolve
      // normally in production), so assert the stable provider key rather than the unobservable values.
      expect(saml.authorizationUrlParams).toMatchObject({ provider: "saml" });

      expect(
        callMapper(saml.mapProfileToUser, { email: "e@saml.test", id: 7, firstName: "Eve", lastName: "Ng" })
      ).toEqual({ email: "e@saml.test", name: "Eve Ng" });
      expect(captureSsoIdentity).toHaveBeenLastCalledWith({
        email: "e@saml.test",
        providerAccountId: "7",
      });

      expect(callMapper(saml.mapProfileToUser, { email: "f@saml.test", id: 8, name: "Full Name" })).toEqual({
        email: "f@saml.test",
        name: "Full Name",
      });
    });

    test("registers all three generic-OAuth providers together when enabled", async () => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        OIDC_OAUTH_ENABLED: true,
        OIDC_ISSUER: "https://idp.test",
        SAML_OAUTH_ENABLED: true,
      });
      expect(m.ssoGenericOAuthConfig.map((c) => c.providerId)).toEqual(["azuread", "openid", "saml"]);
    });
  });
});
