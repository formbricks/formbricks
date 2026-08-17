import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  checkAuthorizationUpdated: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getOrganizationIdFromIntegrationId: vi.fn(),
  getWorkspaceIdFromIntegrationId: vi.fn(),
  createOrUpdateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  getIntegrationByType: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getOrganizationIdFromIntegrationId: mocks.getOrganizationIdFromIntegrationId,
  getWorkspaceIdFromIntegrationId: mocks.getWorkspaceIdFromIntegrationId,
}));

vi.mock("@/lib/integration/service", () => ({
  createOrUpdateIntegration: mocks.createOrUpdateIntegration,
  deleteIntegration: mocks.deleteIntegration,
  getIntegrationByType: mocks.getIntegrationByType,
}));

vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, handler) => handler),
}));

const { createOrUpdateIntegrationAction, deleteIntegrationAction } = await import("./actions");

const STORED_INTEGRATION = {
  id: "integration1",
  type: "googleSheets" as const,
  workspaceId: "ws1",
  config: {
    key: {
      access_token: "ya29.super-secret",
      refresh_token: "1//refresh-secret",
      expiry_date: 1_800_000_000_000,
    },
    data: [],
    email: "owner@example.com",
  },
};

const ctx = {
  user: { id: "user1" },
  auditLoggingCtx: {} as Record<string, unknown>,
};

const callCreateOrUpdate = () =>
  (createOrUpdateIntegrationAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { ...ctx, auditLoggingCtx: {} },
    parsedInput: {
      workspaceId: "ws1",
      integrationData: { type: "googleSheets", config: { key: {}, data: [], email: "" } },
    },
  });

const callDelete = () =>
  (deleteIntegrationAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { ...ctx, auditLoggingCtx: {} },
    parsedInput: { integrationId: "integration1" },
  });

describe("integration actions — ENG-2292 credential exposure in action responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org1");
    mocks.getOrganizationIdFromIntegrationId.mockResolvedValue("org1");
    mocks.getWorkspaceIdFromIntegrationId.mockResolvedValue("ws1");
    mocks.getIntegrationByType.mockResolvedValue(STORED_INTEGRATION);
    mocks.createOrUpdateIntegration.mockResolvedValue(STORED_INTEGRATION);
    mocks.deleteIntegration.mockResolvedValue(STORED_INTEGRATION);
  });

  test("createOrUpdateIntegrationAction returns only the integration id", async () => {
    const result = await callCreateOrUpdate();

    expect(result).toStrictEqual({ id: "integration1" });
    expect(JSON.stringify(result)).not.toContain("ya29.super-secret");
    expect(JSON.stringify(result)).not.toContain("1//refresh-secret");
  });

  test("deleteIntegrationAction returns only the integration id", async () => {
    const result = await callDelete();

    expect(result).toStrictEqual({ id: "integration1" });
    expect(JSON.stringify(result)).not.toContain("ya29.super-secret");
    expect(JSON.stringify(result)).not.toContain("1//refresh-secret");
  });

  // Both mutations are rate limited per user. Asserting the literal policy rather than importing the
  // config, so a loosened interval or allowance fails here instead of shipping.
  test.each([
    ["createOrUpdateIntegrationAction", callCreateOrUpdate],
    ["deleteIntegrationAction", callDelete],
  ])("%s rate limits per user before mutating", async (_name, call) => {
    await call();

    expect(mocks.applyRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      { interval: 60, allowedPerInterval: 30, namespace: "action:integration-mutation" },
      "user1"
    );
  });

  test("a tripped rate limit stops the update before the integration is written", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Maximum number of requests reached"));

    await expect(callCreateOrUpdate()).rejects.toThrow(TooManyRequestsError);
    expect(mocks.getIntegrationByType).not.toHaveBeenCalled();
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("a tripped rate limit stops the delete before the integration is removed", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Maximum number of requests reached"));

    await expect(callDelete()).rejects.toThrow(TooManyRequestsError);
    expect(mocks.deleteIntegration).not.toHaveBeenCalled();
  });

  test("the stored credentials are still written back on update", async () => {
    await callCreateOrUpdate();

    expect(mocks.createOrUpdateIntegration).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({ config: expect.objectContaining({ key: STORED_INTEGRATION.config.key }) })
    );
  });
});
