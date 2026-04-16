import { describe, expect, test, vi } from "vitest";
import { getSSOProviders } from "./providers";

// Mock environment variables
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    GITHUB_ID: "test-github-id",
    GITHUB_SECRET: "test-github-secret",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    AZUREAD_CLIENT_ID: "test-azure-client-id",
    AZUREAD_CLIENT_SECRET: "test-azure-client-secret",
    AZUREAD_TENANT_ID: "test-azure-tenant-id",
    OIDC_CLIENT_ID: "test-oidc-client-id",
    OIDC_CLIENT_SECRET: "test-oidc-client-secret",
    OIDC_DISPLAY_NAME: "Test OIDC",
    OIDC_ISSUER: "https://test-issuer.com",
    OIDC_SIGNING_ALGORITHM: "RS256",
    WEBAPP_URL: "https://test-app.com",
  };
});

describe("SSO Providers", () => {
  test("should return all configured providers", () => {
    const providers = getSSOProviders();
    expect(providers).toHaveLength(5); // GitHub, Google, Azure AD, OIDC, and SAML
  });

  test("should configure OIDC provider correctly", () => {
    const providers = getSSOProviders();
    const oidcProvider = providers[3];

    expect(oidcProvider.id).toBe("openid");
    expect(oidcProvider.name).toBe("Test OIDC");
    expect((oidcProvider as any).clientId).toBe("test-oidc-client-id");
    expect((oidcProvider as any).clientSecret).toBe("test-oidc-client-secret");
    expect((oidcProvider as any).wellKnown).toBe("https://test-issuer.com/.well-known/openid-configuration");
    expect((oidcProvider as any).client?.id_token_signed_response_alg).toBe("RS256");
    expect(oidcProvider.checks).toContain("pkce");
    expect(oidcProvider.checks).toContain("state");
  });

  test("should map the OIDC profile into the Formbricks user shape", () => {
    const providers = getSSOProviders();
    const oidcProvider = providers[3];

    expect(
      oidcProvider.profile?.({
        sub: "oidc-user-1",
        name: "OIDC User",
        email: "oidc@example.com",
      } as any)
    ).toEqual({
      id: "oidc-user-1",
      name: "OIDC User",
      email: "oidc@example.com",
    });
  });

  test("should configure SAML provider correctly", () => {
    const providers = getSSOProviders();
    const samlProvider = providers[4];
    const googleProvider = providers[1];
    const azureProvider = providers[2];

    expect(samlProvider.id).toBe("saml");
    expect(azureProvider.id).toBe("azuread");
    expect(samlProvider.name).toBe("BoxyHQ SAML");
    expect((samlProvider as any).version).toBe("2.0");
    expect(samlProvider.checks).toContain("pkce");
    expect(samlProvider.checks).toContain("state");
    expect((samlProvider as any).authorization?.url).toBe("https://test-app.com/api/auth/saml/authorize");
    expect(samlProvider.token).toBe("https://test-app.com/api/auth/saml/token");
    expect(samlProvider.userinfo).toBe("https://test-app.com/api/auth/saml/userinfo");
    expect(googleProvider.allowDangerousEmailAccountLinking).toBeUndefined();
    expect(samlProvider.allowDangerousEmailAccountLinking).toBeUndefined();
  });

  test("should map the SAML profile and trim empty name parts", () => {
    const providers = getSSOProviders();
    const samlProvider = providers[4];

    expect(
      samlProvider.profile?.({
        id: "saml-user-1",
        email: "saml@example.com",
        firstName: "Saml",
        lastName: "",
      } as any)
    ).toEqual({
      id: "saml-user-1",
      email: "saml@example.com",
      name: "Saml",
    });
  });

  test("falls back to empty Azure credentials when legacy env vars are unset", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/constants")>();
      return {
        ...actual,
        AZUREAD_CLIENT_ID: undefined,
        AZUREAD_CLIENT_SECRET: undefined,
        AZUREAD_TENANT_ID: undefined,
      };
    });

    const { getSSOProviders: getProvidersWithMissingAzureEnv } = await import("./providers");
    const azureProvider = getProvidersWithMissingAzureEnv()[2] as any;

    expect(azureProvider.id).toBe("azuread");
    expect(azureProvider.options.clientId).toBe("");
    expect(azureProvider.options.clientSecret).toBe("");
    expect(azureProvider.options.tenantId).toBe("");
  });
});
