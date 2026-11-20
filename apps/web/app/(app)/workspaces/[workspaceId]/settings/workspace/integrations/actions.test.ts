import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createOrUpdateIntegration,
  getIntegrationByType,
  getStoredIntegrationConfig,
} from "@/lib/integration/service";
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
  createOrUpdateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  getIntegrationByType: vi.fn(),
  getStoredIntegrationConfig: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromIntegrationId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(async () => "org_1"),
  getWorkspaceIdFromIntegrationId: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));

const CIPHERTEXT = `${"a".repeat(32)}:${"b".repeat(8)}:${"c".repeat(32)}`;

describe("createOrUpdateIntegrationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOrUpdateIntegration).mockResolvedValue({ id: "int_1" } as never);
  });

  test("writes back the stored ciphertext, never the decrypted view of a token that no longer decrypts", async () => {
    vi.mocked(getStoredIntegrationConfig).mockResolvedValue({
      config: { key: { access_token: CIPHERTEXT }, data: [], email: "" },
    } as never);
    // What the decrypted read returns for that row: the token blanked to "".
    vi.mocked(getIntegrationByType).mockResolvedValue({
      config: { key: { access_token: "" }, data: [], email: "" },
    });

    await (createOrUpdateIntegrationAction as unknown as ActionHandler)({
      ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
      parsedInput: {
        workspaceId: "ws_1",
        // The settings UI echoes the redacted key.
        integrationData: { type: "slack", config: { key: { access_token: "" }, data: [], email: "" } },
      },
    });

    expect(createOrUpdateIntegration).toHaveBeenCalledWith(
      "ws_1",
      expect.objectContaining({ config: expect.objectContaining({ key: { access_token: CIPHERTEXT } }) })
    );
  });
});
