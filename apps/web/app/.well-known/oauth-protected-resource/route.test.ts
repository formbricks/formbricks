import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { GET } from "./[[...resource]]/route";

// Only the env-dependent URL getters are mocked. The scope constants are the real ones —
// mocking them with literals would make these tests assert the mock against itself and mask
// scope drift between the PRM advertisement and the grantable set (the ENG-1055 offline_access
// bug class: DCR clients register with exactly the scopes advertised here).
vi.mock("@/modules/auth/lib/oauth-urls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/lib/oauth-urls")>()),
  getAuthIssuerUrl: () => "https://app.example.com/api/auth",
  getMcpResourceUrl: () => "https://app.example.com/api/mcp",
}));

const { MCP_OAUTH_SCOPES, MCP_CHALLENGE_SCOPE } = await import("@/modules/auth/lib/oauth-urls");

const createRequest = () =>
  new NextRequest("https://app.example.com/.well-known/oauth-protected-resource/api/mcp");

describe("OAuth protected resource metadata", () => {
  test("returns the same MCP resource for root and /api/mcp metadata paths", async () => {
    const rootResponse = await GET(createRequest(), { params: Promise.resolve({}) });
    const mcpResponse = await GET(createRequest(), {
      params: Promise.resolve({ resource: ["api", "mcp"] }),
    });

    expect(rootResponse.status).toBe(200);
    expect(mcpResponse.status).toBe(200);
    expect(rootResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400"
    );
    await expect(rootResponse.json()).resolves.toEqual(await mcpResponse.json());
  });

  test("returns MCP protected resource metadata advertising offline_access for DCR clients", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ resource: ["api", "mcp"] }),
    });

    await expect(response.json()).resolves.toEqual({
      resource: "https://app.example.com/api/mcp",
      authorization_servers: ["https://app.example.com/api/auth"],
      // offline_access must stay advertised: MCP clients register (DCR) with exactly these
      // scopes, and the oauth-provider plugin validates /authorize against the client's
      // registered scopes — dropping it re-breaks refresh-token issuance for all MCP clients.
      scopes_supported: [
        "surveys:read",
        "surveys:write",
        "workflows:read",
        "workflows:write",
        "feedbackRecords:read",
        "feedbackRecords:write",
        "offline_access",
      ],
      bearer_methods_supported: ["header"],
    });
  });

  test("every advertised scope is grantable by the authorization server", async () => {
    // Runtime twin of the `satisfies` check on MCP_PROTECTED_RESOURCE_SCOPES: anything the PRM
    // advertises must be in the oauthProvider `scopes` allowlist, or clients register with a
    // scope the AS will reject at /authorize.
    const response = await GET(createRequest(), {
      params: Promise.resolve({ resource: ["api", "mcp"] }),
    });
    const { scopes_supported: scopesSupported } = (await response.json()) as {
      scopes_supported: string[];
    };

    expect(scopesSupported.length).toBeGreaterThan(0);
    for (const scope of scopesSupported) {
      expect(MCP_OAUTH_SCOPES).toContain(scope);
    }
  });

  test("the 401 WWW-Authenticate challenge scope matches scopes_supported exactly", async () => {
    // The regression guard for ENG-2175. A client that hits the MCP 401 before fetching this
    // document uses the challenge string as its DCR `scope`; the oauth-provider then validates
    // /authorize against the client's REGISTERED scopes. If the challenge is narrower than what
    // this document advertises, the client registers narrow, authorizes wide, and its first
    // connect fails with `invalid_scope` — succeeding only on retry, once the metadata is cached.
    // A superset is not enough: these two must be exactly equal.
    const response = await GET(createRequest(), {
      params: Promise.resolve({ resource: ["api", "mcp"] }),
    });
    const { scopes_supported: scopesSupported } = (await response.json()) as {
      scopes_supported: string[];
    };

    expect(MCP_CHALLENGE_SCOPE.split(" ")).toEqual(scopesSupported);
    expect(MCP_CHALLENGE_SCOPE).toContain("offline_access");
  });

  test("returns 404 for unrelated protected resource metadata paths", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ resource: ["api", "other"] }),
    });

    expect(response.status).toBe(404);
  });
});
