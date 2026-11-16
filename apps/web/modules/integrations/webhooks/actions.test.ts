import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getWebhookSecretAction } from "./actions";

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
