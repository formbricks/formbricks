import { describe, expect, test, vi } from "vitest";
import { getBaseUrlFromMcpUrl, getSetupGuideUrl, getSetupGuideUrls } from "./urls";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ getMcpResourceUrl: vi.fn() }));

vi.mock("@/modules/auth/lib/oauth-urls", () => ({ getMcpResourceUrl: mocks.getMcpResourceUrl }));

describe("getBaseUrlFromMcpUrl", () => {
  test("strips the MCP path and keeps a custom subpath", () => {
    expect(getBaseUrlFromMcpUrl("https://app.example.com/api/mcp")).toBe("https://app.example.com");
    expect(getBaseUrlFromMcpUrl("https://example.com/forms/api/mcp")).toBe("https://example.com/forms");
  });
});

describe("setup guide URLs", () => {
  test("derive from the MCP resource URL", () => {
    mocks.getMcpResourceUrl.mockReturnValue("https://app.example.com/api/mcp");

    expect(getSetupGuideUrls()).toEqual({
      baseUrl: "https://app.example.com",
      mcpUrl: "https://app.example.com/api/mcp",
    });
    expect(getSetupGuideUrl()).toBe("https://app.example.com/agents/setup.md");
  });
});
