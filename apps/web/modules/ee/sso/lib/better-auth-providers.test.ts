import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PINNED_SSO_PROVIDER_IDS } from "@/modules/auth/lib/legacy-sso-callback";

// captureSsoIdentity is request-scoped (server-only AsyncLocalStorage); stub it so the mappers run in
// isolation and we can assert the identity each provider captures.
const { captureSsoIdentity } = vi.hoisted(() => ({ captureSsoIdentity: vi.fn() }));
vi.mock("./sso-request-context", () => ({ captureSsoIdentity }));

// The module warns at import time when a pseudo-tenant is configured (ENG-2750); capture it.
const { loggerWarn } = vi.hoisted(() => ({ loggerWarn: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: loggerWarn } }));

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
  loggerWarn.mockClear();
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
    /**
     * Identity derivation must not depend on whether discovery ran (ENG-2343). Better Auth's default is
     * `isOidc ? profile.sub : profile.id`, and `isOidc` is set only inside the discovery branch — so the
     * Azure `common` path and the SAML bridge, which both configure endpoints explicitly, would fall to
     * `profile.id`. Microsoft Graph `/oidc/userinfo` returns only `sub`, which yielded an empty subject
     * and failed the callback with `unable_to_get_user_info`. BoxyHQ genuinely returns `id`, so the two
     * differ and both have to be pinned rather than inferred.
     */
    test.each([
      ["azuread", { sub: "az-sub", id: "wrong" }, "az-sub"],
      ["openid", { sub: "oidc-sub", id: "wrong" }, "oidc-sub"],
      ["saml", { id: "saml-id", sub: "wrong" }, "saml-id"],
    ])(
      "%s derives its account subject from the field that provider actually sends",
      async (providerId, profile, expected) => {
        const m = await loadProviders({
          ENTERPRISE_LICENSE_KEY: "lic",
          AZURE_OAUTH_ENABLED: true,
          OIDC_OAUTH_ENABLED: true,
          SAML_OAUTH_ENABLED: true,
        });
        const provider = m.ssoGenericOAuthConfig.find((c) => c.providerId === providerId);

        expect(provider?.accountSubject).toBeDefined();
        expect(provider?.accountSubject?.({ profile } as never)).toBe(expected);
      }
    );

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

    /**
     * ENG-2750: `common` and `organizations` must NOT take the discovery branch. Their discovery
     * documents advertise the literal `{tenantid}` placeholder as `issuer`, which 1.7's literal `iss`
     * comparison can never match — with `AZUREAD_TENANT_ID=common` in the env (Cloud prod's config),
     * every Microsoft sign-in failed verification and landed on `?error=unable_to_get_user_info`.
     * The authority is preserved in the endpoint URLs: `organizations` still restricts which account
     * types Microsoft accepts at the authorize endpoint.
     *
     * `consumers` is deliberately absent — it advertises a real issuer, so it belongs with the
     * discovery cases below.
     */
    test.each([
      ["common", "common"],
      ["organizations", "organizations"],
      // Case-insensitive and trimmed (an operator-typed env var), and emitted in canonical lower case.
      ["Common", "common"],
      [" common ", "common"],
      ["ORGANIZATIONS", "organizations"],
    ])(
      "Azure treats the template-issuer authority %j like unset: explicit endpoints, no discovery",
      async (value, inUrl) => {
        const m = await loadProviders({
          ENTERPRISE_LICENSE_KEY: "lic",
          AZURE_OAUTH_ENABLED: true,
          AZUREAD_TENANT_ID: value,
        });
        const azure = m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread");

        expect(azure?.discoveryUrl).toBeUndefined();
        expect(azure?.authorizationUrl).toBe(
          `https://login.microsoftonline.com/${inUrl}/oauth2/v2.0/authorize`
        );
        expect(azure?.tokenUrl).toBe(`https://login.microsoftonline.com/${inUrl}/oauth2/v2.0/token`);
        expect(azure?.userInfoUrl).toBe("https://graph.microsoft.com/oidc/userinfo");
        // The operator set a value and is getting the weaker multi-tenant mode — that must be visible.
        expect(loggerWarn).toHaveBeenCalledTimes(1);
        expect(loggerWarn.mock.calls[0][0]).toContain("placeholder issuer");
      }
    );

    /**
     * The warning must not describe this as "treating it like unset". Unset resolves to `common`,
     * which accepts personal accounts, so an operator who chose `organizations` to allow only
     * work/school accounts would read that as having silently lost the restriction — while in fact
     * only id_token verification is given up and the authority still applies at the authorize
     * endpoint. Pinned because it is a deliberate wording decision, not incidental phrasing.
     */
    test("the tenant warning says the configured authority still applies, not that it is ignored", async () => {
      await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        AZUREAD_TENANT_ID: "organizations",
      });

      expect(loggerWarn).toHaveBeenCalledTimes(1);
      const message = loggerWarn.mock.calls[0][0] as string;
      expect(message).toContain("still applies");
      expect(message).not.toMatch(/like unset|treated as unset/i);
    });

    /**
     * Every tenant whose discovery document carries a real issuer keeps the stronger discovery path.
     * `consumers` is the one that is easy to get wrong: it looks like a sibling of `common` and
     * `organizations`, but all personal Microsoft accounts live in one well-known MSA tenant, so its
     * discovery document names that tenant as the issuer and its id_tokens verify. Treating it as a
     * placeholder authority would silently drop a check that works today.
     */
    test.each([
      ["a verified domain", "contoso.onmicrosoft.com", "contoso.onmicrosoft.com"],
      ["the personal-accounts authority", "consumers", "consumers"],
      ["a mixed-case value, passed through unchanged", "Contoso.OnMicrosoft.com", "Contoso.OnMicrosoft.com"],
    ])("Azure uses discovery for %s", async (_label, value, inUrl) => {
      const m = await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        AZUREAD_TENANT_ID: value,
      });
      const azure = m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread");

      expect(azure?.discoveryUrl).toBe(
        `https://login.microsoftonline.com/${inUrl}/v2.0/.well-known/openid-configuration`
      );
      expect(azure?.authorizationUrl).toBeUndefined();
      expect(azure?.tokenUrl).toBeUndefined();
    });

    test.each([
      ["unset", undefined],
      ["whitespace only", "   "],
      ["a concrete tenant", "00000000-1111-2222-3333-444444444444"],
      ["the personal-accounts authority", "consumers"],
    ])("Azure does not warn when the tenant is %s", async (_label, value) => {
      await loadProviders({
        ENTERPRISE_LICENSE_KEY: "lic",
        AZURE_OAUTH_ENABLED: true,
        AZUREAD_TENANT_ID: value,
      });

      expect(loggerWarn).not.toHaveBeenCalled();
    });

    /**
     * The warning describes how Azure sign-in will behave, so it is pointless — and misleading — on an
     * instance that registers no Azure provider. Both cases below reach that state, and registration
     * needs BOTH gates, so the warning has to check both too: an unlicensed instance with Azure
     * credentials configured is just as provider-less as a licensed one with none.
     */
    test.each([
      ["Azure SSO is disabled", { ENTERPRISE_LICENSE_KEY: "lic", AZURE_OAUTH_ENABLED: false }],
      ["the instance is unlicensed", { ENTERPRISE_LICENSE_KEY: undefined, AZURE_OAUTH_ENABLED: true }],
    ])("Azure does not warn about a template-issuer authority when %s", async (_label, overrides) => {
      const m = await loadProviders({ ...overrides, AZUREAD_TENANT_ID: "common" });

      expect(m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread")).toBeUndefined();
      expect(loggerWarn).not.toHaveBeenCalled();
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

    /**
     * ENG-2754: the generic OIDC provider shares ENG-2750's failure mode, because it too resolves its
     * endpoints from a discovery document. Pointed at a Microsoft multi-tenant authority it would
     * verify id_tokens against a `{tenantid}` placeholder and fail every sign-in, so those authorities
     * skip discovery here too — and the operator is told to prefer the dedicated azuread provider.
     */
    const oidcBase = {
      ENTERPRISE_LICENSE_KEY: "lic",
      OIDC_OAUTH_ENABLED: true,
      OIDC_CLIENT_ID: "oidc-id",
      OIDC_CLIENT_SECRET: "oidc-secret",
    };

    test.each([
      ["https://login.microsoftonline.com/common/v2.0", "common"],
      ["https://login.microsoftonline.com/organizations/v2.0", "organizations"],
      // Case and a trailing slash are operator typing, not a different provider.
      ["https://LOGIN.microsoftonline.com/Common/", "common"],
      // No /v2.0 suffix: the authority is the first path segment either way.
      ["https://login.microsoftonline.com/common", "common"],
    ])("OIDC pointed at %s skips discovery and uses Microsoft's endpoints", async (issuer, authority) => {
      const m = await loadProviders({ ...oidcBase, OIDC_ISSUER: issuer });
      const oidc = m.ssoGenericOAuthConfig.find((c) => c.providerId === "openid");

      expect(oidc?.discoveryUrl).toBeUndefined();
      expect(oidc?.authorizationUrl).toBe(
        `https://login.microsoftonline.com/${authority}/oauth2/v2.0/authorize`
      );
      expect(oidc?.tokenUrl).toBe(`https://login.microsoftonline.com/${authority}/oauth2/v2.0/token`);
      expect(oidc?.userInfoUrl).toBe("https://graph.microsoft.com/oidc/userinfo");
      // Account keying must not move, or existing linked accounts stop matching.
      expect(oidc?.accountIssuer).toBe("local:oauth:openid");
      expect(loggerWarn).toHaveBeenCalledTimes(1);
      // Recommends the dedicated provider, and — like the azuread warning — does not imply the
      // configured authority has been discarded, since `organizations` keeps restricting sign-in.
      const message = loggerWarn.mock.calls[0][0] as string;
      expect(message).toContain("AZUREAD_CLIENT_ID");
      expect(message).toContain("still applies");
      expect(message).not.toMatch(/like unset|treated as unset/i);
    });

    /**
     * Everything else keeps discovery. `consumers` is included deliberately: it is a Microsoft
     * authority but advertises a real issuer, so it must not be swept up with the other two — the same
     * distinction ENG-2750 turns on. The lookalike host guards against matching on a substring.
     */
    test.each([
      ["a normal IdP", "https://idp.test"],
      ["Microsoft's personal-accounts authority", "https://login.microsoftonline.com/consumers/v2.0"],
      [
        "a concrete Microsoft tenant",
        "https://login.microsoftonline.com/00000000-1111-2222-3333-444444444444/v2.0",
      ],
      ["a lookalike host", "https://login.microsoftonline.com.evil.test/common/v2.0"],
    ])("OIDC keeps discovery for %s", async (_label, issuer) => {
      const m = await loadProviders({ ...oidcBase, OIDC_ISSUER: issuer });
      const oidc = m.ssoGenericOAuthConfig.find((c) => c.providerId === "openid");

      expect(oidc?.discoveryUrl).toBe(`${issuer}/.well-known/openid-configuration`);
      expect(oidc?.authorizationUrl).toBeUndefined();
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    test("OIDC does not warn about a Microsoft authority when the instance is unlicensed", async () => {
      const m = await loadProviders({
        ...oidcBase,
        ENTERPRISE_LICENSE_KEY: undefined,
        OIDC_ISSUER: "https://login.microsoftonline.com/common/v2.0",
      });

      expect(m.ssoGenericOAuthConfig.find((c) => c.providerId === "openid")).toBeUndefined();
      expect(loggerWarn).not.toHaveBeenCalled();
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

/**
 * Raised in review on #9017: setting `userInfoUrl` does not guarantee Better Auth calls it.
 *
 * `fetchUserInfo` opens with `decodeJwt(tokens.idToken)` — decode, not verify — and returns those
 * claims whenever the token carries `sub` and `email`, never touching the userinfo endpoint. The
 * explicit-endpoint branch deliberately has no `idToken` config, so nothing validates that token's
 * signature, issuer or nonce, and we request the `email` scope, so a real Microsoft token takes the
 * shortcut every time.
 *
 * These tests drive the provider Better Auth actually initialises rather than the config object,
 * because the config object cannot show which of the two paths runs — asserting `userInfoUrl` is
 * exactly the check that passed while the shortcut was live.
 */
describe("Azure identity comes from Graph, not an unverified id_token (#9017 review)", () => {
  // An UNSIGNED token carrying the claims the shortcut looks for. If it is ever accepted, an
  // attacker-supplied token would be too.
  const forgedIdToken = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(
    JSON.stringify({ sub: "forged-subject", email: "attacker@evil.test", name: "Forged" })
  ).toString("base64url")}.`;

  const initializedAzureProvider = async (tenant?: string) => {
    const m = await loadProviders({
      ENTERPRISE_LICENSE_KEY: "lic",
      AZURE_OAUTH_ENABLED: true,
      AZUREAD_CLIENT_ID: "az-id",
      AZUREAD_CLIENT_SECRET: "az-secret",
      AZUREAD_TENANT_ID: tenant,
    });
    const { betterAuth } = await import("better-auth");
    const { memoryAdapter } = await import("better-auth/adapters/memory");
    const { genericOAuth } = await import("better-auth/plugins");
    const auth = betterAuth({
      baseURL: "https://app.formbricks.test",
      secret: "sso-provider-contract-secret-0123456789",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      plugins: [genericOAuth({ config: m.ssoGenericOAuthConfig })],
    });
    const ctx = await auth.$context;
    return ctx.socialProviders.find((p) => p.id === "azuread");
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each([["common"], ["organizations"], [undefined]])(
    "tenant %s: a forged id_token is never accepted as the identity",
    async (tenant) => {
      // Graph is unreachable, so the ONLY way to produce a profile is the unverified shortcut.
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("graph unreachable");
        })
      );

      const provider = await initializedAzureProvider(tenant);
      const result = await provider?.getUserInfo?.({
        accessToken: "access-token",
        idToken: forgedIdToken,
      } as never);

      expect(result).toBeNull();
    }
  );

  test("the identity is the Graph response, and Graph is actually called", async () => {
    const graph = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sub: "graph-subject", email: "real@corp.test", name: "Real User" }),
    }));
    vi.stubGlobal("fetch", graph);

    const provider = await initializedAzureProvider("common");
    const result = await provider?.getUserInfo?.({
      accessToken: "access-token",
      idToken: forgedIdToken,
    } as never);

    expect(graph).toHaveBeenCalledWith(
      "https://graph.microsoft.com/oidc/userinfo",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token" } })
    );
    // The forged subject must not appear anywhere in the resolved identity.
    expect(result?.user).toMatchObject({ email: "real@corp.test" });
    expect(JSON.stringify(result)).not.toContain("forged-subject");
    expect(JSON.stringify(result)).not.toContain("attacker@evil.test");
  });

  test("a Graph error fails the sign-in closed rather than falling back to the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    );

    const provider = await initializedAzureProvider("common");
    expect(await provider?.getUserInfo?.({ accessToken: "t", idToken: forgedIdToken } as never)).toBeNull();
  });

  // The concrete-tenant branch keeps discovery, where Better Auth verifies the id_token before any
  // profile is resolved — so it is intentionally left on the default path.
  test("a concrete tenant still uses discovery, not the Graph override", async () => {
    const m = await loadProviders({
      ENTERPRISE_LICENSE_KEY: "lic",
      AZURE_OAUTH_ENABLED: true,
      AZUREAD_TENANT_ID: "00000000-1111-2222-3333-444444444444",
    });
    const azure = m.ssoGenericOAuthConfig.find((c) => c.providerId === "azuread");

    expect(azure?.getUserInfo).toBeUndefined();
    expect(azure?.discoveryUrl).toBeDefined();
  });
});

/**
 * Raised in review on #9023: the generic OIDC provider reaches the same explicit-endpoint branch when
 * `OIDC_ISSUER` points at a Microsoft multi-tenant authority, so it inherited the same unverified
 * id_token shortcut. Driven through the initialised provider, for the same reason as the azuread
 * suite above: the config object cannot show which of the two paths actually runs.
 *
 * Also pins the sweep result — `saml` reaches an explicit-endpoint branch too but is NOT affected,
 * because it requests no `openid` scope, so BoxyHQ never mints an id_token for the shortcut to read.
 */
describe("OIDC identity comes from Graph when pointed at Microsoft (#9023 review)", () => {
  const forgedIdToken = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(
    JSON.stringify({ sub: "forged-subject", email: "attacker@evil.test" })
  ).toString("base64url")}.`;

  const initializedProvider = async (providerId: string, overrides: Partial<MockConstants>) => {
    const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic", ...overrides });
    const { betterAuth } = await import("better-auth");
    const { memoryAdapter } = await import("better-auth/adapters/memory");
    const { genericOAuth } = await import("better-auth/plugins");
    const auth = betterAuth({
      baseURL: "https://app.formbricks.test",
      secret: "sso-oidc-contract-secret-0123456789ab",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      plugins: [genericOAuth({ config: m.ssoGenericOAuthConfig })],
    });
    return (await auth.$context).socialProviders.find((p) => p.id === providerId);
  };

  const oidcAtMicrosoft = {
    OIDC_OAUTH_ENABLED: true,
    OIDC_CLIENT_ID: "oidc-id",
    OIDC_CLIENT_SECRET: "oidc-secret",
    OIDC_ISSUER: "https://login.microsoftonline.com/common/v2.0",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("a forged id_token is never accepted as the identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("graph unreachable");
      })
    );

    const provider = await initializedProvider("openid", oidcAtMicrosoft);
    expect(await provider?.getUserInfo?.({ accessToken: "t", idToken: forgedIdToken } as never)).toBeNull();
  });

  test("the identity is the Graph response, and Graph is actually called", async () => {
    const graph = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sub: "graph-subject", email: "real@corp.test", name: "Real User" }),
    }));
    vi.stubGlobal("fetch", graph);

    const provider = await initializedProvider("openid", oidcAtMicrosoft);
    const result = await provider?.getUserInfo?.({
      accessToken: "access-token",
      idToken: forgedIdToken,
    } as never);

    expect(graph).toHaveBeenCalledWith("https://graph.microsoft.com/oidc/userinfo", expect.anything());
    expect(JSON.stringify(result)).not.toContain("forged-subject");
    expect(JSON.stringify(result)).not.toContain("attacker@evil.test");
  });

  test("a normal OIDC issuer keeps discovery and the default profile path", async () => {
    const m = await loadProviders({
      ENTERPRISE_LICENSE_KEY: "lic",
      ...oidcAtMicrosoft,
      OIDC_ISSUER: "https://idp.test",
    });
    const oidc = m.ssoGenericOAuthConfig.find((c) => c.providerId === "openid");

    expect(oidc?.getUserInfo).toBeUndefined();
    expect(oidc?.discoveryUrl).toBe("https://idp.test/.well-known/openid-configuration");
  });

  /**
   * The sweep result, pinned. `saml` also configures explicit endpoints with no discovery, which is
   * the shape that exposed the other two — but BoxyHQ only mints an id_token for an OIDC-flow request
   * (`requestedOIDCFlow` in Jackson's oauth controller), and this provider requests no scopes at all.
   * No id_token means the shortcut cannot fire, so no override is needed. If someone ever adds
   * `openid` to these scopes, this test fails and says why.
   */
  test("saml requests no openid scope, so no id_token exists for the shortcut to read", async () => {
    const m = await loadProviders({ ENTERPRISE_LICENSE_KEY: "lic", SAML_OAUTH_ENABLED: true });
    const saml = m.ssoGenericOAuthConfig.find((c) => c.providerId === "saml");

    expect(saml?.scopes ?? []).not.toContain("openid");
    expect(saml?.discoveryUrl).toBeUndefined();
  });
});
