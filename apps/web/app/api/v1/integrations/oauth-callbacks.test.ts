import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET as notionCallback } from "./notion/callback/route";
import { GET as slackCallback } from "./slack/callback/route";

// The guards both OAuth callbacks run before they touch the provider: the session, the one-time OAuth
// state, the workspace it names and the user's write access, and a provider error sent back to the
// settings page. `withV1ApiWrapper` is reduced to its handler.
const mocks = vi.hoisted(() => ({
  consumeIntegrationOAuthState: vi.fn(),
  canUserWriteWorkspaceIntegrations: vi.fn(),
  createOrUpdateIntegration: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/lib/constants", () => ({
  ENCRYPTION_KEY: "k".repeat(32),
  NOTION_OAUTH_CLIENT_ID: "notion-id",
  NOTION_OAUTH_CLIENT_SECRET: "notion-secret",
  NOTION_REDIRECT_URI: "https://app.example.com/api/v1/integrations/notion/callback",
  SLACK_CLIENT_ID: "slack-id",
  SLACK_CLIENT_SECRET: "slack-secret",
  SLACK_REDIRECT_URI: "https://app.example.com/api/v1/integrations/slack/callback",
  WEBAPP_URL: "https://app.example.com",
}));
vi.mock("@/lib/oauth/integration-state", async () => {
  class IntegrationOAuthStateError extends Error {}
  return {
    IntegrationOAuthStateError,
    consumeIntegrationOAuthState: mocks.consumeIntegrationOAuthState,
    getSafeOAuthCallbackError: (error: string | null) => (error ? "access_denied" : null),
  };
});
vi.mock("@/lib/workspace/auth", () => ({
  canUserWriteWorkspaceIntegrations: mocks.canUserWriteWorkspaceIntegrations,
}));
vi.mock("@/lib/integration/service", () => ({
  createOrUpdateIntegration: mocks.createOrUpdateIntegration,
  getIntegrationByType: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));

const WORKSPACE_ID = "clws00000000000000000001";
const user = { user: { id: "user-1" } };

type TCallback = (input: unknown) => Promise<{ response: Response }>;

const callbacks: [string, TCallback][] = [
  ["notion", notionCallback as unknown as TCallback],
  ["slack", slackCallback as unknown as TCallback],
];

const call = (callback: TCallback, query: string, authentication: unknown = user) =>
  callback({ req: new Request(`https://app.example.com/callback?${query}`), authentication });

describe.each(callbacks)("%s OAuth callback guards", (provider, callback) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.consumeIntegrationOAuthState.mockResolvedValue({ workspaceId: WORKSPACE_ID });
    mocks.canUserWriteWorkspaceIntegrations.mockResolvedValue(true);
  });

  test("refuses a request without a user session", async () => {
    const { response } = await call(callback, "state=s&code=c", null);

    expect(response.status).toBe(401);
    expect(mocks.consumeIntegrationOAuthState).not.toHaveBeenCalled();
  });

  test("refuses an invalid OAuth state", async () => {
    const { IntegrationOAuthStateError } = await import("@/lib/oauth/integration-state");
    mocks.consumeIntegrationOAuthState.mockRejectedValue(new IntegrationOAuthStateError());

    const { response } = await call(callback, "state=s&code=c");

    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test("rethrows any other failure to read the state", async () => {
    mocks.consumeIntegrationOAuthState.mockRejectedValue(new Error("cache down"));

    await expect(call(callback, "state=s&code=c")).rejects.toThrow("cache down");
  });

  test("consumes the state for this provider and user", async () => {
    mocks.canUserWriteWorkspaceIntegrations.mockResolvedValue(false);

    await call(callback, "state=s&code=c");

    expect(mocks.consumeIntegrationOAuthState).toHaveBeenCalledWith({
      provider,
      userId: "user-1",
      state: "s",
    });
  });

  test("refuses a state that names no workspace", async () => {
    mocks.consumeIntegrationOAuthState.mockResolvedValue({ workspaceId: undefined });

    const { response } = await call(callback, "state=s&code=c");

    expect(response.status).toBe(400);
    expect(mocks.canUserWriteWorkspaceIntegrations).not.toHaveBeenCalled();
  });

  test("refuses a user who cannot write the workspace's integrations", async () => {
    mocks.canUserWriteWorkspaceIntegrations.mockResolvedValue(false);

    const { response } = await call(callback, "state=s&code=c");

    expect(response.status).toBe(401);
    expect(mocks.canUserWriteWorkspaceIntegrations).toHaveBeenCalledWith("user-1", WORKSPACE_ID);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("sends a provider error without a code back to the integration page", async () => {
    const { response } = await call(callback, "state=s&error=access_denied");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `https://app.example.com/workspaces/${WORKSPACE_ID}/settings/workspace/integrations/${provider}?error=access_denied`
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
