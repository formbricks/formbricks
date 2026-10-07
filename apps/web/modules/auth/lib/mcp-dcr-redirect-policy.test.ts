import { beforeEach, describe, expect, test, vi } from "vitest";

// Hoisted so the same objects survive `vi.resetModules()`, which each test uses to get a fresh memo.
const { mockEnv, mockLogger } = vi.hoisted(() => ({
  mockEnv: { MCP_DCR_ALLOWED_REDIRECT_URIS: undefined as string[] | undefined },
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@formbricks/logger", () => ({ logger: mockLogger }));

const loadPolicy = async () => {
  vi.resetModules();
  return import("./mcp-dcr-redirect-policy");
};

const CLAUDE_AI = "https://claude.ai/api/mcp/auth_callback";
const CLAUDE_COM = "https://claude.com/api/mcp/auth_callback";
const CHATGPT = "https://chatgpt.com/connector_platform_oauth_redirect";

beforeEach(() => {
  mockEnv.MCP_DCR_ALLOWED_REDIRECT_URIS = undefined;
  mockLogger.info.mockClear();
});

/**
 * ENG-3086. The redirect-URI allowlist that closes the open DCR consent-phishing hole: an anonymous
 * registration may only claim a redirect URI a remote attacker cannot receive an authorization code at.
 * `http` loopback (RFC 8252 §7.3) is the first such form.
 */
describe("isLoopbackRedirectUri (ENG-3086)", () => {
  test.each(["http://localhost:8080/cb", "http://127.0.0.1:1/cb", "http://[::1]:9000/cb"])(
    "accepts %s",
    async (uri) => {
      const { isLoopbackRedirectUri } = await loadPolicy();
      expect(isLoopbackRedirectUri(uri)).toBe(true);
    }
  );

  test.each([
    "https://localhost:8080/cb",
    "https://example.com/cb1",
    "https://attacker-controlled-test.example.org/cb",
    "http://evil.example.com/cb",
    "com.example.app:/callback",
    "file:///tmp/cb",
    "not a url",
    null,
    42,
  ])("rejects %s", async (uri) => {
    const { isLoopbackRedirectUri } = await loadPolicy();
    expect(isLoopbackRedirectUri(uri)).toBe(false);
  });
});

/**
 * ENG-3471. The second form: an exact hosted-connector callback. claude.ai and ChatGPT connect from the
 * vendor's cloud and register a fixed `https` callback on the vendor's own origin, so a code sent there
 * only ever reaches the vendor. Exact string match (OAuth 2.1 / RFC 9700 §4.1): any variation is a
 * different URI an attacker might control.
 */
describe("isAllowedDcrRedirectUri (ENG-3471)", () => {
  test.each([CLAUDE_AI, CLAUDE_COM, CHATGPT])("accepts the hosted callback %s", async (uri) => {
    const { getAllowedDcrRedirectUris, isAllowedDcrRedirectUri } = await loadPolicy();
    expect(isAllowedDcrRedirectUri(uri, getAllowedDcrRedirectUris())).toBe(true);
  });

  test("still accepts loopback", async () => {
    const { getAllowedDcrRedirectUris, isAllowedDcrRedirectUri } = await loadPolicy();
    expect(isAllowedDcrRedirectUri("http://127.0.0.1:33418/callback", getAllowedDcrRedirectUris())).toBe(
      true
    );
  });

  test.each([
    "https://claude.ai.evil.com/api/mcp/auth_callback",
    "https://evil.claude.ai/api/mcp/auth_callback",
    "http://claude.ai/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback/",
    "https://claude.ai/api/mcp/auth_callbackx",
    "https://CLAUDE.ai/api/mcp/auth_callback",
    "https://claude.ai:443/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback?next=https://evil.com",
    "https://claude.ai/api/mcp/auth_callback#x",
    "https://claude.ai/api/mcp/other",
    "https://claude.ai/",
    "https://chatgpt.com/connector/oauth/abc123",
    "https://chatgpt.com/connector_platform_oauth_redirect/../evil",
    "https://evil.com/?https://claude.ai/api/mcp/auth_callback",
  ])("rejects the lookalike %s", async (uri) => {
    const { getAllowedDcrRedirectUris, isAllowedDcrRedirectUri } = await loadPolicy();
    expect(isAllowedDcrRedirectUri(uri, getAllowedDcrRedirectUris())).toBe(false);
  });

  test("accepts an operator-added URI exactly, and only that URI", async () => {
    mockEnv.MCP_DCR_ALLOWED_REDIRECT_URIS = ["https://client.example.com/oauth/callback"];
    const { getAllowedDcrRedirectUris, isAllowedDcrRedirectUri } = await loadPolicy();
    const allowed = getAllowedDcrRedirectUris();

    expect(isAllowedDcrRedirectUri("https://client.example.com/oauth/callback", allowed)).toBe(true);
    expect(isAllowedDcrRedirectUri("https://client.example.com/oauth/callback2", allowed)).toBe(false);
    // Additions extend the built-ins; they never replace them.
    expect(isAllowedDcrRedirectUri(CLAUDE_AI, allowed)).toBe(true);
  });

  test("logs operator additions once, without their query strings", async () => {
    mockEnv.MCP_DCR_ALLOWED_REDIRECT_URIS = ["https://client.example.com/oauth/callback?tenant=s3cret"];
    const { getAllowedDcrRedirectUris } = await loadPolicy();

    getAllowedDcrRedirectUris();
    getAllowedDcrRedirectUris();

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockLogger.info.mock.calls)).not.toContain("s3cret");
    expect(mockLogger.info.mock.calls[0][0]).toEqual({
      redirectUris: ["https://client.example.com/oauth/callback"],
    });
  });

  test("logs nothing when there are no operator additions", async () => {
    const { getAllowedDcrRedirectUris } = await loadPolicy();
    getAllowedDcrRedirectUris();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe("findDisallowedRedirectUri (ENG-3086, ENG-3471)", () => {
  const find = async (client: unknown) => {
    const { findDisallowedRedirectUri, getAllowedDcrRedirectUris } = await loadPolicy();
    return findDisallowedRedirectUri(JSON.stringify(client), getAllowedDcrRedirectUris());
  };

  test("returns null for an all-loopback registration", async () => {
    expect(await find({ redirect_uris: ["http://127.0.0.1:33418/callback"] })).toBeNull();
  });

  // claude.ai's real body carries both of its callbacks; allowing only one would still fail it.
  test("returns null for claude.ai's registration with both callbacks", async () => {
    expect(await find({ redirect_uris: [CLAUDE_AI, CLAUDE_COM] })).toBeNull();
  });

  test("returns null for ChatGPT's registration", async () => {
    expect(await find({ redirect_uris: [CHATGPT] })).toBeNull();
  });

  test("flags a non-loopback redirect_uri", async () => {
    expect(await find({ redirect_uris: ["https://evil.example.com/cb"] })).toEqual({
      field: "redirect_uris",
      uri: "https://evil.example.com/cb",
    });
  });

  test("flags an attacker URI even when a hosted callback is also present", async () => {
    expect(await find({ redirect_uris: [CLAUDE_AI, "https://evil.example.com/cb"] })).toEqual({
      field: "redirect_uris",
      uri: "https://evil.example.com/cb",
    });
  });

  test("flags a non-loopback URI even when a loopback one is also present", async () => {
    expect(await find({ redirect_uris: ["http://127.0.0.1:1/cb", "http://evil.example.com/cb"] })).toEqual({
      field: "redirect_uris",
      uri: "http://evil.example.com/cb",
    });
  });

  test("flags a non-loopback post_logout_redirect_uri", async () => {
    expect(await find({ post_logout_redirect_uris: ["https://evil.example.com/logout"] })).toEqual({
      field: "post_logout_redirect_uris",
      uri: "https://evil.example.com/logout",
    });
  });

  // Hosted callbacks are allowed for redirect_uris only; no hosted connector registers a logout target.
  test("flags a hosted callback used as a post_logout_redirect_uri", async () => {
    expect(await find({ post_logout_redirect_uris: [CLAUDE_AI] })).toEqual({
      field: "post_logout_redirect_uris",
      uri: CLAUDE_AI,
    });
  });

  test("returns null for a body without redirect URIs", async () => {
    expect(await find({ client_name: "x" })).toBeNull();
  });

  // A malformed body must reach upstream unchanged and produce upstream's own error, not ours.
  test.each(["not json", "[1,2,3]", "null", '"a string"'])(
    "returns null for malformed body %s",
    async (body) => {
      const { findDisallowedRedirectUri, getAllowedDcrRedirectUris } = await loadPolicy();
      expect(findDisallowedRedirectUri(body, getAllowedDcrRedirectUris())).toBeNull();
    }
  );
});
