import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { GET } from "./[[...resource]]/route";

vi.mock("@/modules/auth/lib/oauth-urls", () => ({
  getAuthIssuerUrl: () => "https://app.example.com/api/auth",
  getMcpResourceUrl: () => "https://app.example.com/api/mcp",
  MCP_RESOURCE_SCOPES: ["surveys:read", "surveys:write"],
}));

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

  test("returns MCP protected resource metadata", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ resource: ["api", "mcp"] }),
    });

    await expect(response.json()).resolves.toEqual({
      resource: "https://app.example.com/api/mcp",
      authorization_servers: ["https://app.example.com/api/auth"],
      scopes_supported: ["surveys:read", "surveys:write"],
      bearer_methods_supported: ["header"],
    });
  });

  test("returns 404 for unrelated protected resource metadata paths", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ resource: ["api", "other"] }),
    });

    expect(response.status).toBe(404);
  });
});
