import { describe, expect, test, vi } from "vitest";
import { getSSOProviders } from "./providers";

type TSsoProvider = ReturnType<typeof getSSOProviders>[number];
type TOidcProvider = Extract<TSsoProvider, { id: "openid" }>;
type TSamlProvider = Extract<TSsoProvider, { id: "saml" }>;
type TAzureProvider = Extract<TSsoProvider, { id: "azure-ad" }>;

const getProviderById = <TId extends TSsoProvider["id"]>(id: TId): Extract<TSsoProvider, { id: TId }> => {
  const provider = getSSOProviders().find(
    (candidate): candidate is Extract<TSsoProvider, { id: TId }> => candidate.id === id
  );

  if (!provider) {
    throw new Error(`Provider with id ${id} not found`);
  }

  return provider;
};

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
    const oidcProvider = getProviderById("openid") as TOidcProvider;

    expect(oidcProvider.id).toBe("openid");
    expect(oidcProvider.name).toBe("Test OIDC");
    expect(oidcProvider.clientId).toBe("test-oidc-client-id");
    expect(oidcProvider.clientSecret).toBe("test-oidc-client-secret");
    expect(oidcProvider.wellKnown).toBe("https://test-issuer.com/.well-known/openid-configuration");
    expect(oidcProvider.client?.id_token_signed_response_alg).toBe("RS256");
    expect(oidcProvider.checks).toContain("pkce");
    expect(oidcProvider.checks).toContain("state");
  });

  test("should map the OIDC profile into the Formbricks user shape", () => {
    const oidcProvider = getProviderById("openid") as TOidcProvider;
    const oidcProfile: Parameters<NonNullable<TOidcProvider["profile"]>>[0] = {
      sub: "oidc-user-1",
      name: "OIDC User",
      email: "oidc@example.com",
    };

    expect(oidcProvider.profile?.(oidcProfile)).toEqual({
      id: "oidc-user-1",
      name: "OIDC User",
      email: "oidc@example.com",
    });
  });

  test("should configure SAML provider correctly", () => {
    const samlProvider = getProviderById("saml") as TSamlProvider;
    const googleProvider = getProviderById("google");
    const azureProvider = getProviderById("azure-ad") as TAzureProvider;

    expect(samlProvider.id).toBe("saml");
    expect(azureProvider.id).toBe("azure-ad");
    expect(samlProvider.name).toBe("BoxyHQ SAML");
    expect(samlProvider.version).toBe("2.0");
    expect(samlProvider.checks).toContain("pkce");
    expect(samlProvider.checks).toContain("state");
    expect(samlProvider.authorization?.url).toBe("https://test-app.com/api/auth/saml/authorize");
    expect(samlProvider.token).toBe("https://test-app.com/api/auth/saml/token");
    expect(samlProvider.userinfo).toBe("https://test-app.com/api/auth/saml/userinfo");
    expect(googleProvider.options?.checks).toContain("nonce");
    expect(googleProvider.allowDangerousEmailAccountLinking).toBeUndefined();
    expect(samlProvider.allowDangerousEmailAccountLinking).toBeUndefined();
  });

  test("should map the SAML profile and trim empty name parts", () => {
    const samlProvider = getProviderById("saml") as TSamlProvider;
    const samlProfile: Parameters<NonNullable<TSamlProvider["profile"]>>[0] = {
      id: "saml-user-1",
      email: "saml@example.com",
      firstName: "Saml",
      lastName: "",
    };

    expect(samlProvider.profile?.(samlProfile)).toEqual({
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
    const azureProvider = getProvidersWithMissingAzureEnv().find(
      (provider): provider is TAzureProvider => provider.id === "azure-ad"
    );

    if (!azureProvider) {
      throw new Error("Azure provider not found");
    }

    expect(azureProvider.id).toBe("azure-ad");
    expect(azureProvider.options.clientId).toBe("");
    expect(azureProvider.options.clientSecret).toBe("");
    expect(azureProvider.options.tenantId).toBe("");
  });
});
