import { beforeEach, describe, expect, test, vi } from "vitest";

const envMock = {
  MCP_OAUTH_JWKS_URL: undefined as string | undefined,
  PUBLIC_URL: undefined as string | undefined,
  WEBAPP_URL: undefined as string | undefined,
};

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

// `AUTH_URL` is the already-resolved BETTER_AUTH_URL/NEXTAUTH_URL value; which of the two wins is
// constants.ts's business and is covered by lib/constants.test.ts. Mocked here — not `@/lib/env` —
// because mocking the raw vars would no longer steer these helpers at all.
const constantsMock = {
  AUTH_URL: undefined as string | undefined,
};

vi.mock("@/lib/constants", () => constantsMock);

const loadOAuthUrls = async () => {
  vi.resetModules();
  return await import("./oauth-urls");
};

describe("OAuth URL helpers", () => {
  beforeEach(() => {
    envMock.MCP_OAUTH_JWKS_URL = undefined;
    envMock.PUBLIC_URL = undefined;
    envMock.WEBAPP_URL = undefined;
    constantsMock.AUTH_URL = undefined;
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

  test("derives the auth issuer from the configured auth URL, preserving subpaths", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com";
    constantsMock.AUTH_URL = "https://auth.example.com/custom";

    const { getAuthIssuerUrl } = await loadOAuthUrls();

    expect(getAuthIssuerUrl()).toBe("https://auth.example.com/custom/api/auth");
  });

  test("does not append /api/auth twice when auth URL already includes it", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com";
    constantsMock.AUTH_URL = "https://admin.example.com/app/api/auth";

    const { getAuthIssuerUrl } = await loadOAuthUrls();

    expect(getAuthIssuerUrl()).toBe("https://admin.example.com/app/api/auth");
  });

  // The MCP resource server allow-lists this exact string as the second permitted `aud` value, so
  // a drift here would reject every token carrying the openid-implied UserInfo audience. Pinned
  // against the issuer (not WEBAPP_URL) because that is the prefix the oauth-provider mounts under.
  test("derives the UserInfo audience from the auth issuer, subpath included", async () => {
    envMock.WEBAPP_URL = "https://admin.example.com";
    constantsMock.AUTH_URL = "https://auth.example.com/custom";

    const { getAuthIssuerUrl, getOAuthUserInfoUrl } = await loadOAuthUrls();

    expect(getOAuthUserInfoUrl()).toBe("https://auth.example.com/custom/api/auth/oauth2/userinfo");
    expect(getOAuthUserInfoUrl()).toBe(`${getAuthIssuerUrl()}/oauth2/userinfo`);
  });

  test("derives the JWKS URL from the public issuer by default", async () => {
    constantsMock.AUTH_URL = "https://auth.example.com";

    const { getMcpOAuthJwksUrl } = await loadOAuthUrls();

    expect(getMcpOAuthJwksUrl()).toBe("https://auth.example.com/api/auth/jwks");
  });

  test("uses an internal JWKS URL without changing the public issuer", async () => {
    constantsMock.AUTH_URL = "https://auth.example.com";
    envMock.MCP_OAUTH_JWKS_URL = "http://formbricks:3000/api/auth/jwks";

    const { getAuthIssuerUrl, getMcpOAuthJwksUrl } = await loadOAuthUrls();

    expect(getAuthIssuerUrl()).toBe("https://auth.example.com/api/auth");
    expect(getMcpOAuthJwksUrl()).toBe("http://formbricks:3000/api/auth/jwks");
  });
});

/**
 * The setup guide's `invalid_scope` entry lists "the scopes the server advertises" by hand, and a user
 * who hits that error reads it to decide whether their client is misconfigured. It has already drifted
 * once: the commit that added `responses:*` to the advertised metadata added them here too, and the
 * commit that then made them grantable-but-unadvertised did not take them back out — so the doc named
 * two scopes a client asking for them would be rejected for.
 *
 * Read as text rather than parsed as MDX: the value under test is a literal list inside one prose
 * sentence, so a regex is enough and it keeps an MDX parser out of the unit suite. Same approach as
 * `mcp-oauth-resource-seed.test.ts`.
 */
describe("the setup guide's advertised-scope list", () => {
  test("names exactly the scopes the protected-resource metadata advertises", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { MCP_PROTECTED_RESOURCE_SCOPES } = await loadOAuthUrls();

    const guide = readFileSync(resolve(process.cwd(), "../../docs/platform/mcp/setup.mdx"), "utf8");
    const sentence = /re-registers\s+with the scopes the server advertises \(([^)]*)\)/.exec(
      guide.replace(/\s+/g, " ")
    );

    expect(sentence, "the advertised-scope sentence moved or was reworded").not.toBeNull();

    const documented = [...sentence![1].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    expect(documented).toEqual([...MCP_PROTECTED_RESOURCE_SCOPES]);
  });
});
