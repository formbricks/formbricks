import { beforeEach, describe, expect, test, vi } from "vitest";
import { MCP_HANDLER_OPTIONS, identifyMcpUser } from "./server";

vi.mock("server-only", () => ({}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/posthog/mcp-tracing", () => ({
  instrumentMcpServerWithTracing: vi.fn(),
}));

vi.mock("./tools/feedback-records", () => ({ registerFeedbackRecordTools: vi.fn() }));
vi.mock("./tools/surveys", () => ({ registerSurveyTools: vi.fn() }));
vi.mock("./tools/workflows", () => ({ registerWorkflowTools: vi.fn() }));
vi.mock("./tools/workspaces", () => ({ registerWorkspaceTools: vi.fn() }));

const mocks = vi.hoisted(() => ({
  getMcpAuthentication: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMcpAuthentication: mocks.getMcpAuthentication,
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

describe("mcpHandler options", () => {
  /**
   * Asserts the wiring, not the SDK's behaviour: `maxSubscriptions: 0` is what stops a 2026-era client
   * opening a `subscriptions/listen` stream this server can never send anything on. Verified separately
   * against the real SDK — a listen request with 0 returns `-32603 Subscription limit reached` on plain
   * JSON with the connection closed, where the default (1024 per process) accepts it and holds it open.
   * Worth pinning because dropping the option is invisible: nothing else fails, the stream just reopens.
   */
  test("refuses subscription streams", () => {
    expect(MCP_HANDLER_OPTIONS.maxSubscriptions).toBe(0);
  });
});

describe("identifyMcpUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when there is no authentication", async () => {
    mocks.getMcpAuthentication.mockReturnValue(null);

    const identity = await identifyMcpUser({}, { http: { authInfo: undefined } });

    expect(identity).toBeNull();
  });

  test("derives distinctId and organization group for API key auth", async () => {
    mocks.getMcpAuthentication.mockReturnValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
    });

    const identity = await identifyMcpUser({}, { http: { authInfo: { extra: {} } } });

    expect(identity).toEqual({
      distinctId: "apiKey:key_1",
      groups: { organization: "org_1" },
    });
  });

  test("derives distinctId from the session user for OAuth auth with no group (avoids a DB lookup)", async () => {
    mocks.getMcpAuthentication.mockReturnValue({
      user: { id: "user_1" },
      expires: "2099-01-01",
    });

    const identity = await identifyMcpUser({}, { http: { authInfo: { extra: {} } } });

    expect(identity).toEqual({ distinctId: "user_1" });
  });

  // The two tests below assert WHERE the token is read from, not just that identification works. Every
  // other test here mocks getMcpAuthentication, so it would pass whether or not the right location was
  // read - and a missed location degrades every MCP event to an anonymous distinctId silently, because
  // identity is best-effort by design. These pin both shapes @posthog/mcp's compat context can carry.
  test("reads the token from the SDK v2 location (ctx.http.authInfo)", async () => {
    const authInfo = { token: "v2", extra: {} };
    mocks.getMcpAuthentication.mockReturnValue({ user: { id: "user_v2" }, expires: "2099-01-01" });

    const identity = await identifyMcpUser({}, { http: { authInfo } });

    expect(mocks.getMcpAuthentication).toHaveBeenCalledWith(authInfo);
    expect(identity).toEqual({ distinctId: "user_v2" });
  });

  test("still reads the flat v1 location when the analytics SDK supplies that shape", async () => {
    const authInfo = { token: "v1", extra: {} };
    mocks.getMcpAuthentication.mockReturnValue({ user: { id: "user_v1" }, expires: "2099-01-01" });

    const identity = await identifyMcpUser({}, { authInfo });

    expect(mocks.getMcpAuthentication).toHaveBeenCalledWith(authInfo);
    expect(identity).toEqual({ distinctId: "user_v1" });
  });

  test("returns null and logs a warning instead of throwing when identification fails", async () => {
    const error = new Error("boom");
    mocks.getMcpAuthentication.mockImplementation(() => {
      throw error;
    });

    const identity = await identifyMcpUser({}, { http: { authInfo: { extra: {} } } });

    expect(identity).toBeNull();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error },
      "Failed to identify MCP user for PostHog tracing"
    );
  });
});
