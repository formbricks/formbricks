import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkFeedbackRecordDirectoryAccess, checkWorkspaceAccess } from "./access";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  getFeedbackRecordDirectoryAuthContext: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/modules/ee/feedback-record-directory/lib/feedback-record-directory", () => ({
  getFeedbackRecordDirectoryAuthContext: mocks.getFeedbackRecordDirectoryAuthContext,
}));

const accessInput = {
  feedbackRecordDirectoryId: "frd-1",
  organizationId: "organization-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  source: "charts.executeQueryAction",
};

const workspaceAccessInput = {
  organizationId: "organization-1",
  userId: "user-1",
  workspaceId: "workspace-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkWorkspaceAccess", () => {
  test("returns organizationId and workspaceId on successful access check", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(workspaceAccessInput.organizationId);
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);

    const result = await checkWorkspaceAccess(
      workspaceAccessInput.userId,
      workspaceAccessInput.workspaceId,
      "readWrite"
    );

    expect(result).toEqual({
      organizationId: workspaceAccessInput.organizationId,
      workspaceId: workspaceAccessInput.workspaceId,
    });
    expect(mocks.getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith(workspaceAccessInput.workspaceId);
    expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: workspaceAccessInput.userId,
      organizationId: workspaceAccessInput.organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", minPermission: "readWrite", workspaceId: workspaceAccessInput.workspaceId },
      ],
    });
  });

  test("propagates authorization errors from checkAuthorizationUpdated", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(workspaceAccessInput.organizationId);
    mocks.checkAuthorizationUpdated.mockRejectedValue(new Error("Unauthorized"));

    await expect(
      checkWorkspaceAccess(workspaceAccessInput.userId, workspaceAccessInput.workspaceId, "manage")
    ).rejects.toThrow("Unauthorized");
  });
});

describe("checkFeedbackRecordDirectoryAccess", () => {
  test("returns the feedback record directory ID when it belongs to the authorized workspace", async () => {
    mocks.getFeedbackRecordDirectoryAuthContext.mockResolvedValue({
      organizationId: "organization-1",
      workspaceIds: ["workspace-1"],
      isArchived: false,
    });

    await expect(checkFeedbackRecordDirectoryAccess(accessInput)).resolves.toEqual({
      feedbackRecordDirectoryId: "frd-1",
    });
  });

  test("rejects inaccessible feedback record directories with an audit-safe warning", async () => {
    mocks.getFeedbackRecordDirectoryAuthContext.mockResolvedValue({
      organizationId: "organization-1",
      workspaceIds: ["workspace-2"],
      isArchived: false,
    });

    await expect(checkFeedbackRecordDirectoryAccess(accessInput)).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackRecordDirectoryId: "frd-1",
        organizationId: "organization-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        source: "charts.executeQueryAction",
      }),
      "Feedback record directory access denied for Cube query"
    );
  });

  test("logs unexpected lookup failures before rethrowing", async () => {
    const error = new Error("database unavailable");
    mocks.getFeedbackRecordDirectoryAuthContext.mockRejectedValue(error);

    await expect(checkFeedbackRecordDirectoryAccess(accessInput)).rejects.toThrow("database unavailable");
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        feedbackRecordDirectoryId: "frd-1",
        organizationId: "organization-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        source: "charts.executeQueryAction",
      }),
      "Failed to verify feedback record directory access for Cube query"
    );
  });
});
