import { beforeEach, describe, expect, test, vi } from "vitest";
import { identifyMcpUser } from "./server";

vi.mock("server-only", () => ({}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/posthog", () => ({
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

describe("identifyMcpUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when there is no authentication", async () => {
    mocks.getMcpAuthentication.mockReturnValue(null);

    const identity = await identifyMcpUser({}, { authInfo: undefined });

    expect(identity).toBeNull();
  });

  test("derives distinctId and organization group for API key auth", async () => {
    mocks.getMcpAuthentication.mockReturnValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
    });

    const identity = await identifyMcpUser({}, { authInfo: { extra: {} } });

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

    const identity = await identifyMcpUser({}, { authInfo: { extra: {} } });

    expect(identity).toEqual({ distinctId: "user_1" });
  });

  test("returns null and logs a warning instead of throwing when identification fails", async () => {
    const error = new Error("boom");
    mocks.getMcpAuthentication.mockImplementation(() => {
      throw error;
    });

    const identity = await identifyMcpUser({}, { authInfo: { extra: {} } });

    expect(identity).toBeNull();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error },
      "Failed to identify MCP user for PostHog tracing"
    );
  });
});
