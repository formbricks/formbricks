import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { generateWebhookSecret } from "@/lib/crypto";
import { testEndpoint } from "@/modules/integrations/webhooks/lib/webhook";
import { getWebhookSecretAction, testEndpointAction } from "./actions";

const mocks = vi.hoisted(() => ({
  getWebhookWithSecret: vi.fn(),
  getWorkspaceIdFromWebhookId: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ generateWebhookSecret: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/survey/visibility/outbound", () => ({ assertNewlyAttachedSurveysWorkspaceVisible: vi.fn() }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: () => ({ action: (handler: object) => handler }),
  },
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWebhookId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromWebhookId: mocks.getWorkspaceIdFromWebhookId,
}));
vi.mock("@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook", () => ({
  getWebhook: vi.fn(),
  getWebhookWithSecret: mocks.getWebhookWithSecret,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_a, _b, handler) => handler),
}));
vi.mock("@/modules/integrations/webhooks/lib/webhook", () => ({
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testEndpoint: vi.fn(),
  updateWebhook: vi.fn(),
}));

const run = (getWebhookSecretAction as unknown as (a: unknown) => Promise<unknown>).bind(null);
const input = { ctx: { user: { id: "user-1" } }, parsedInput: { webhookId: "webhook-1" } };

describe("getWebhookSecretAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceIdFromWebhookId.mockResolvedValue("ws-1");
    mocks.getWebhookWithSecret.mockResolvedValue({ ok: true, data: { secret: "whsec_abc" } });
  });

  test("returns the secret to a caller with workspace.write", async () => {
    await expect(run(input)).resolves.toEqual({ secret: "whsec_abc" });
    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "workspace.write", {
      type: "workspace",
      id: "ws-1",
    });
  });

  test("spends the caller's own reveal budget, not the workspace's write budget", async () => {
    await run(input);

    expect(mocks.applyRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:webhook-secret-reveal" }),
      "user-1"
    );
  });

  test("refuses a read-only caller before the secret is read", async () => {
    vi.mocked(assertCan).mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(run(input)).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.getWebhookWithSecret).not.toHaveBeenCalled();
  });
});

describe("getWebhookSecretAction missing secret", () => {
  test("throws not-found instead of returning an empty secret", async () => {
    mocks.getWorkspaceIdFromWebhookId.mockResolvedValue("ws-1");
    mocks.getWebhookWithSecret.mockResolvedValue({ ok: true, data: { secret: null } });
    await expect(run(input)).rejects.toThrow();
  });
});

describe("testEndpointAction", () => {
  const runTest = (testEndpointAction as unknown as (a: unknown) => Promise<unknown>).bind(null);
  const ctx = { user: { id: "user-1" } };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceIdFromWebhookId.mockResolvedValue("ws-1");
    vi.mocked(generateWebhookSecret).mockReturnValue("whsec_throwaway");
    mocks.getWebhookWithSecret.mockResolvedValue({
      ok: true,
      data: { url: "https://stored.example.com/hook", secret: "whsec_stored" },
    });
  });

  test("rate limits per user", async () => {
    await runTest({
      ctx,
      parsedInput: { url: "https://stored.example.com/hook", webhookId: "webhook-1", workspaceId: "ws-1" },
    });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:webhook-test" }),
      "user-1"
    );
  });

  test("signs the stored URL with the stored secret and does not return the secret", async () => {
    const result = await runTest({
      ctx,
      parsedInput: { url: "https://stored.example.com/hook", webhookId: "webhook-1", workspaceId: "ws-1" },
    });
    expect(testEndpoint).toHaveBeenCalledWith("https://stored.example.com/hook", "whsec_stored");
    expect(result).toEqual({ success: true });
  });

  test("never signs a different URL with the stored secret", async () => {
    const result = await runTest({
      ctx,
      parsedInput: { url: "https://attacker.example.com", webhookId: "webhook-1", workspaceId: "ws-1" },
    });
    expect(testEndpoint).toHaveBeenCalledWith("https://attacker.example.com", "whsec_throwaway");
    expect(result).toEqual({ success: true });
  });

  test("authorizes against the webhook's workspace, not the caller-supplied one", async () => {
    await runTest({
      ctx,
      parsedInput: {
        url: "https://stored.example.com/hook",
        webhookId: "webhook-1",
        workspaceId: "ws-other",
      },
    });
    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "workspace.write", {
      type: "workspace",
      id: "ws-1",
    });
  });

  test("returns the secret only for a new webhook", async () => {
    const result = await runTest({
      ctx,
      parsedInput: { url: "https://new.example.com", workspaceId: "ws-1" },
    });
    expect(testEndpoint).toHaveBeenCalledWith("https://new.example.com", "whsec_throwaway");
    expect(result).toEqual({ success: true, secret: "whsec_throwaway" });
  });

  test("a rate-limited caller sends nothing", async () => {
    mocks.applyRateLimit.mockRejectedValueOnce(new Error("rate limited"));
    await expect(
      runTest({ ctx, parsedInput: { url: "https://x.example.com", workspaceId: "ws-1" } })
    ).rejects.toThrow("rate limited");
    expect(testEndpoint).not.toHaveBeenCalled();
  });

  test("a refused caller sends nothing", async () => {
    vi.mocked(assertCan).mockRejectedValueOnce(new AuthorizationError("Not authorized"));
    await expect(
      runTest({ ctx, parsedInput: { url: "https://x.example.com", workspaceId: "ws-1" } })
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(testEndpoint).not.toHaveBeenCalled();
  });
});
