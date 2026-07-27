import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkFeedbackDirectoryAccess, checkWorkspaceAccess } from "./access";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getFeedbackDirectoryAuthContext: vi.fn(),
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

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoryAuthContext: mocks.getFeedbackDirectoryAuthContext,
}));

const accessInput = {
  feedbackDirectoryId: "frd-1",
  organizationId: "organization-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  source: "charts.executeQueryAction" as const,
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
    mocks.assertCan.mockResolvedValue(undefined);

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
    expect(mocks.assertCan).toHaveBeenCalledWith(
      { type: "user", id: workspaceAccessInput.userId },
      "workspace.write",
      { type: "workspace", id: workspaceAccessInput.workspaceId }
    );
  });

  test("propagates authorization errors from the central interface", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(workspaceAccessInput.organizationId);
    mocks.assertCan.mockRejectedValue(new Error("Unauthorized"));

    await expect(
      checkWorkspaceAccess(workspaceAccessInput.userId, workspaceAccessInput.workspaceId, "manage")
    ).rejects.toThrow("Unauthorized");
  });

  test.each([
    ["read", "workspace.read"],
    ["readWrite", "workspace.write"],
    ["manage", "workspace.manage"],
  ] as const)("maps %s permission to %s", async (permission, action) => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(workspaceAccessInput.organizationId);

    await checkWorkspaceAccess(workspaceAccessInput.userId, workspaceAccessInput.workspaceId, permission);

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: workspaceAccessInput.userId }, action, {
      type: "workspace",
      id: workspaceAccessInput.workspaceId,
    });
  });
});

describe("checkFeedbackDirectoryAccess", () => {
  test("returns the feedback directory ID when it belongs to the authorized workspace", async () => {
    mocks.getFeedbackDirectoryAuthContext.mockResolvedValue({
      organizationId: "organization-1",
      workspaceIds: ["workspace-1"],
      isArchived: false,
    });

    await expect(checkFeedbackDirectoryAccess(accessInput)).resolves.toEqual({
      feedbackDirectoryId: "frd-1",
    });
  });

  test("rejects inaccessible feedback record directories with an audit-safe warning", async () => {
    mocks.getFeedbackDirectoryAuthContext.mockResolvedValue({
      organizationId: "organization-1",
      workspaceIds: ["workspace-2"],
      isArchived: false,
    });

    await expect(checkFeedbackDirectoryAccess(accessInput)).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackDirectoryId: "frd-1",
        organizationId: "organization-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        source: "charts.executeQueryAction",
      }),
      "Feedback directory access denied for Cube query"
    );
  });

  test("logs unexpected lookup failures before rethrowing", async () => {
    const error = new Error("database unavailable");
    mocks.getFeedbackDirectoryAuthContext.mockRejectedValue(error);

    await expect(checkFeedbackDirectoryAccess(accessInput)).rejects.toThrow("database unavailable");
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        feedbackDirectoryId: "frd-1",
        organizationId: "organization-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        source: "charts.executeQueryAction",
      }),
      "Failed to verify feedback directory access for Cube query"
    );
  });
});
