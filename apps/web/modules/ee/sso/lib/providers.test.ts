import { describe, expect, test, vi } from "vitest";
import { getSSOProviders } from "./providers";

// Mock environment variables
vi.mock("@/lib/constants", () => ({
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
}));

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

  test("should configure SAML provider correctly", () => {
    const providers = getSSOProviders();
    const samlProvider = providers[4];

    expect(samlProvider.id).toBe("saml");
    expect(samlProvider.name).toBe("BoxyHQ SAML");
    expect((samlProvider as any).version).toBe("2.0");
    expect(samlProvider.checks).toContain("pkce");
    expect(samlProvider.checks).toContain("state");
    expect((samlProvider as any).authorization?.url).toBe("https://test-app.com/api/auth/saml/authorize");
    expect(samlProvider.token).toBe("https://test-app.com/api/auth/saml/token");
    expect(samlProvider.userinfo).toBe("https://test-app.com/api/auth/saml/userinfo");
    expect(samlProvider.allowDangerousEmailAccountLinking).toBe(true);
  });
});
