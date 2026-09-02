import { beforeEach, describe, expect, test, vi } from "vitest";
import { assertCan } from "@/lib/authorization";
import { createApiKeyAction, deleteApiKeyAction, updateApiKeyAction } from "./actions";

const mocks = vi.hoisted(() => ({
  capturePostHogEvent: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  getOrganizationIdFromApiKeyId: vi.fn(),
  updateApiKey: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromApiKeyId: mocks.getOrganizationIdFromApiKeyId,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  createApiKey: mocks.createApiKey,
  deleteApiKey: mocks.deleteApiKey,
  updateApiKey: mocks.updateApiKey,
}));

describe("API-key settings authorization", () => {
  const organizationId = "org-1";
  const apiKeyId = "key-1";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromApiKeyId.mockResolvedValue(organizationId);
    mocks.createApiKey.mockResolvedValue({ id: apiKeyId });
    mocks.deleteApiKey.mockResolvedValue({ id: apiKeyId });
    mocks.updateApiKey.mockResolvedValue({ id: apiKeyId });
  });

  test("requires organization.manage_api_keys to create a key", async () => {
    await createApiKeyAction({
      ctx: { user: { id: "user-1" }, auditLoggingCtx: {} },
      parsedInput: {
        organizationId,
        apiKeyData: { label: "Automation" },
      },
    } as never);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "organization.manage_api_keys", {
      type: "organization",
      id: organizationId,
    });
    expect(mocks.createApiKey).toHaveBeenCalled();
  });

  test.each([
    ["delete", deleteApiKeyAction, { id: apiKeyId }],
    ["update", updateApiKeyAction, { apiKeyId, apiKeyData: { label: "Updated" } }],
  ] as const)("requires apiKey.manage to %s a key", async (_name, action, parsedInput) => {
    await action({
      ctx: { user: { id: "user-1" }, auditLoggingCtx: {} },
      parsedInput,
    } as never);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user-1" }, "apiKey.manage", {
      type: "apiKey",
      id: apiKeyId,
    });
  });

  test("does not mutate a key when authorization fails", async () => {
    vi.mocked(assertCan).mockRejectedValue(new Error("not authorized"));

    await expect(
      deleteApiKeyAction({
        ctx: { user: { id: "user-1" }, auditLoggingCtx: {} },
        parsedInput: { id: apiKeyId },
      } as never)
    ).rejects.toThrow("not authorized");

    expect(mocks.deleteApiKey).not.toHaveBeenCalled();
  });
});
