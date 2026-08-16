import { beforeEach, describe, expect, test, vi } from "vitest";
import { assertCan } from "@/lib/authorization";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  createFeedbackDirectoryAction,
  getFeedbackDirectoryDetailsAction,
  updateFeedbackDirectoryAction,
} from "./actions";

const mocks = vi.hoisted(() => {
  const action = vi.fn((handler) => handler);
  return {
    action,
    inputSchema: vi.fn(() => ({ action })),
    createFeedbackDirectory: vi.fn(),
    getFeedbackDirectoryDetails: vi.fn(),
    getOrganizationIdFromDirectoryId: vi.fn(),
    applyRateLimit: vi.fn(),
    updateFeedbackDirectory: vi.fn(),
    getIsFeedbackDirectoriesEnabled: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: mocks.inputSchema },
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_event, _target, handler) => handler),
}));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  createFeedbackDirectory: mocks.createFeedbackDirectory,
  getFeedbackDirectoryDetails: mocks.getFeedbackDirectoryDetails,
  getOrganizationIdFromDirectoryId: mocks.getOrganizationIdFromDirectoryId,
  updateFeedbackDirectory: mocks.updateFeedbackDirectory,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackDirectoriesEnabled: mocks.getIsFeedbackDirectoriesEnabled,
}));

const ctx = { user: { id: "user_1" }, auditLoggingCtx: {} };
const organizationId = "organization_1";
const directoryId = "directory_1";

describe("feedback directory administration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertCan).mockResolvedValue(undefined);
    mocks.getIsFeedbackDirectoriesEnabled.mockResolvedValue(true);
    mocks.getOrganizationIdFromDirectoryId.mockResolvedValue(organizationId);
    mocks.createFeedbackDirectory.mockResolvedValue(directoryId);
    mocks.getFeedbackDirectoryDetails.mockResolvedValue({ id: directoryId, name: "Dataset" });
    mocks.updateFeedbackDirectory.mockResolvedValue({ id: directoryId });
  });

  test.each([
    ["create", createFeedbackDirectoryAction, { organizationId, name: "Dataset" }],
    ["read", getFeedbackDirectoryDetailsAction, { directoryId }],
    ["update", updateFeedbackDirectoryAction, { directoryId, data: { name: "Renamed" } }],
  ])("routes %s through organization.manage", async (_name, action, parsedInput) => {
    await (action as any)({ ctx, parsedInput });

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });

    if (_name === "read") {
      expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    } else {
      expect(mocks.applyRateLimit).toHaveBeenCalledWith(
        rateLimitConfigs.actions.feedbackDirectoryMutation,
        "user_1"
      );
    }
  });
});
