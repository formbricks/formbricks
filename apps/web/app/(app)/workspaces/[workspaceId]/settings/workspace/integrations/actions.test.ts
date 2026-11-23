import { beforeEach, describe, expect, test, vi } from "vitest";
import { saveIntegrationKeepingStoredKey } from "@/lib/integration/service";
import { createOrUpdateIntegrationAction } from "./actions";

type ActionHandler = (args: {
  ctx: { user: { id: string }; auditLoggingCtx: Record<string, unknown> };
  parsedInput: unknown;
}) => Promise<unknown>;

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((handler: ActionHandler) => handler),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action: string, _object: string, handler: ActionHandler) => handler),
}));

vi.mock("@/lib/integration/service", () => ({
  deleteIntegration: vi.fn(),
  saveIntegrationKeepingStoredKey: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromIntegrationId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(async () => "org_1"),
  getWorkspaceIdFromIntegrationId: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));

// The settings UI echoes the redacted key; the row-locked save is where it is merged back.
const integrationData = {
  type: "slack" as const,
  config: { key: { access_token: "" }, data: [], email: "" },
};

describe("createOrUpdateIntegrationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveIntegrationKeepingStoredKey).mockResolvedValue({ id: "int_1" } as never);
  });

  test("delegates the save to the row-locked path and returns only the id", async () => {
    const result = await (createOrUpdateIntegrationAction as unknown as ActionHandler)({
      ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
      parsedInput: { workspaceId: "ws_1", integrationData },
    });

    expect(saveIntegrationKeepingStoredKey).toHaveBeenCalledWith("ws_1", integrationData);
    // ENG-2292: the provider credentials never reach the action's response.
    expect(result).toEqual({ id: "int_1" });
  });
});
