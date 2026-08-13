import { beforeEach, describe, expect, test, vi } from "vitest";

const envMock = {
  BETTER_AUTH_URL: undefined as string | undefined,
  NEXTAUTH_URL: undefined as string | undefined,
  PUBLIC_URL: undefined as string | undefined,
  WEBAPP_URL: undefined as string | undefined,
};

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

const loadOAuthUrls = async () => {
  vi.resetModules();
  return await import("./oauth-urls");
};

describe("OAuth URL helpers", () => {
  beforeEach(() => {
    envMock.BETTER_AUTH_URL = undefined;
    envMock.NEXTAUTH_URL = undefined;
    envMock.PUBLIC_URL = undefined;
    envMock.WEBAPP_URL = undefined;
  });

  test("preserves custom WEBAPP_URL subpaths for the MCP resource", async () => {
    envMock.WEBAPP_URL = "https://app.example.com/formbricks/";

    const { getMcpProtectedResourceMetadataUrl, getMcpResourceUrl } = await loadOAuthUrls();

    expect(getMcpResourceUrl()).toBe("https://app.example.com/formbricks/api/mcp");
    expect(getMcpProtectedResourceMetadataUrl()).toBe(
      "https://app.example.com/formbricks/.well-known/oauth-protected-resource/api/mcp"
    );
  });

  test("does not use PUBLIC_URL for private MCP and OAuth URLs", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com";
    envMock.PUBLIC_URL = "https://surveys.example.com";

    const { getMcpProtectedResourceMetadataUrl, getMcpResourceUrl } = await loadOAuthUrls();

    expect(getMcpResourceUrl()).toBe("https://admin.example.com/api/mcp");
    expect(getMcpProtectedResourceMetadataUrl()).toBe(
      "https://admin.example.com/.well-known/oauth-protected-resource/api/mcp"
    );
  });

  test("normalizes MCP resource URL without query, fragment, or trailing slash", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com/app/?foo=bar#fragment";

    const { getMcpResourceUrl } = await loadOAuthUrls();

    expect(getMcpResourceUrl()).toBe("https://admin.example.com/app/api/mcp");
  });

  test("derives the auth issuer from Better Auth URL while preserving subpaths", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com";
    envMock.NEXTAUTH_URL = "https://auth.example.com/formbricks";
    envMock.BETTER_AUTH_URL = "https://auth.example.com/custom";

    const { getAuthIssuerUrl } = await loadOAuthUrls();

    expect(getAuthIssuerUrl()).toBe("https://auth.example.com/custom/api/auth");
  });

  test("does not append /api/auth twice when auth URL already includes it", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com";
    envMock.BETTER_AUTH_URL = "https://admin.example.com/app/api/auth";

    const { getAuthIssuerUrl } = await loadOAuthUrls();

    expect(getAuthIssuerUrl()).toBe("https://admin.example.com/app/api/auth");
  });

  // The MCP resource server allow-lists this exact string as the second permitted `aud` value, so
  // a drift here would reject every token carrying the openid-implied UserInfo audience. Pinned
  // against the issuer (not WEBAPP_URL) because that is the prefix the oauth-provider mounts under.
  test("derives the UserInfo audience from the auth issuer, subpath included", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com";
    envMock.BETTER_AUTH_URL = "https://auth.example.com/custom";

    const { getAuthIssuerUrl, getOAuthUserInfoUrl } = await loadOAuthUrls();

    expect(getOAuthUserInfoUrl()).toBe("https://auth.example.com/custom/api/auth/oauth2/userinfo");
    expect(getOAuthUserInfoUrl()).toBe(`${getAuthIssuerUrl()}/oauth2/userinfo`);
  });
});
