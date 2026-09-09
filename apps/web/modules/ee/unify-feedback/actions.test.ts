import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { deleteFeedbackRecordAction } from "./actions";

const mocks = vi.hoisted(() => {
  const action = vi.fn((handler) => handler);
  return {
    action,
    inputSchema: vi.fn(() => ({ action })),
    applyRateLimit: vi.fn(),
    ensureDeleteAccess: vi.fn(),
    getWorkspaceDirectoryIds: vi.fn(),
    retrieveFeedbackRecord: vi.fn(),
    deleteFeedbackRecord: vi.fn(),
    assertRecordBelongsToWorkspace: vi.fn(),
    assertFeedbackDirectoryAssignmentAccess: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: mocks.inputSchema },
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_event, _target, handler) => handler),
}));
vi.mock("@/modules/ee/unify-feedback/lib/access", () => ({
  assertFeedbackDirectoryAssignmentAccess: mocks.assertFeedbackDirectoryAssignmentAccess,
  assertRecordBelongsToWorkspace: mocks.assertRecordBelongsToWorkspace,
  ensureDeleteAccess: mocks.ensureDeleteAccess,
  ensureReadAccess: vi.fn(),
  getWorkspaceDirectoryIds: mocks.getWorkspaceDirectoryIds,
}));
vi.mock("@/modules/hub/service", () => ({
  deleteFeedbackRecord: mocks.deleteFeedbackRecord,
  retrieveFeedbackRecord: mocks.retrieveFeedbackRecord,
}));

describe("deleteFeedbackRecordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureDeleteAccess.mockResolvedValue("organization-1");
    mocks.getWorkspaceDirectoryIds.mockResolvedValue(["directory-1"]);
    mocks.retrieveFeedbackRecord.mockResolvedValue({
      data: {
        id: "record-1",
        tenant_id: "directory-1",
        submission_id: "submission-1",
        source_type: "survey",
        source_id: "source-1",
        field_id: "field-1",
        field_type: "text",
        collected_at: "2026-08-16T00:00:00.000Z",
      },
      error: null,
    });
    mocks.deleteFeedbackRecord.mockResolvedValue({ data: { id: "record-1" }, error: null });
  });

  test("rate limits the mutation before deleting the record", async () => {
    const ctx = { user: { id: "user-1" }, auditLoggingCtx: {} };

    await deleteFeedbackRecordAction({
      ctx,
      parsedInput: { recordId: "record-1", workspaceId: "workspace-1" },
    } as any);

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.feedbackRecordDeletion,
      "user-1"
    );
    expect(mocks.deleteFeedbackRecord).toHaveBeenCalledWith("record-1");
    expect(mocks.applyRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteFeedbackRecord.mock.invocationCallOrder[0]
    );
  });
});
