import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("audit-logs lib", () => {
  const workspaceId = "ws-123";
  const apiUrl = "/storage/ws-123/public/file.txt";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("logs file deletion success with provided data", async () => {
    const { getOrganizationIdFromWorkspaceId } = await import("@/lib/utils/helper");
    const { queueAuditEvent } = await import("@/modules/ee/audit-logs/lib/handler");
    const { logFileDeletion } = await import("./audit-logs");

    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org-1");

    await logFileDeletion({
      workspaceId,
      accessType: "public",
      userId: "user-1",
      status: "success",
      oldObject: { key: "value" },
      apiUrl,
    });

    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "file",
        userId: "user-1",
        userType: "user",
        targetId: `${workspaceId}:public`,
        organizationId: "org-1",
        status: "success",
        oldObject: { key: "value" },
        apiUrl,
        newObject: expect.objectContaining({ workspaceId, accessType: "public" }),
      })
    );
  });

  test("logs with UNKNOWN_DATA userId when missing and includes failureReason", async () => {
    const { getOrganizationIdFromWorkspaceId } = await import("@/lib/utils/helper");
    const { queueAuditEvent } = await import("@/modules/ee/audit-logs/lib/handler");
    const { UNKNOWN_DATA } = await import("@/modules/ee/audit-logs/types/audit-log");
    const { logFileDeletion } = await import("./audit-logs");

    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org-2");

    await logFileDeletion({
      workspaceId,
      accessType: "private",
      status: "failure",
      failureReason: "S3 error",
      apiUrl,
    });

    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: UNKNOWN_DATA,
        status: "failure",
        organizationId: "org-2",
        newObject: expect.objectContaining({ failureReason: "S3 error" }),
      })
    );
  });

  test("falls back to UNKNOWN_DATA organizationId when lookup fails", async () => {
    const { getOrganizationIdFromWorkspaceId } = await import("@/lib/utils/helper");
    const { queueAuditEvent } = await import("@/modules/ee/audit-logs/lib/handler");
    const { UNKNOWN_DATA } = await import("@/modules/ee/audit-logs/types/audit-log");
    const { logFileDeletion } = await import("./audit-logs");

    vi.mocked(getOrganizationIdFromWorkspaceId).mockRejectedValueOnce(new Error("fail"));

    await logFileDeletion({
      workspaceId,
      accessType: "public",
      apiUrl,
    });

    expect(queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ organizationId: UNKNOWN_DATA }));
  });

  test("swallows errors from queueAuditEvent and logs", async () => {
    const { getOrganizationIdFromWorkspaceId } = await import("@/lib/utils/helper");
    const { queueAuditEvent } = await import("@/modules/ee/audit-logs/lib/handler");
    const { logger } = await import("@formbricks/logger");
    const { logFileDeletion } = await import("./audit-logs");

    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org-3");
    vi.mocked(queueAuditEvent).mockRejectedValueOnce(new Error("audit fail"));

    await logFileDeletion({ workspaceId, apiUrl });

    expect(logger.error).toHaveBeenCalled();
  });
});
