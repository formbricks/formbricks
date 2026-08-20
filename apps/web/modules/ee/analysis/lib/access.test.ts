import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkFeedbackDirectoryAccess, checkWorkspaceAccess } from "./access";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  can: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: mocks.can }));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

const accessInput = {
  feedbackDirectoryId: "frd-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  minPermission: "read" as const,
  source: "charts.executeQueryAction" as const,
};

const workspaceAccessInput = {
  organizationId: "organization-1",
  userId: "user-1",
  workspaceId: "workspace-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockResolvedValue(true);
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

  test("propagates central authorization errors", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(workspaceAccessInput.organizationId);
    mocks.assertCan.mockRejectedValue(new Error("Unauthorized"));

    await expect(
      checkWorkspaceAccess(workspaceAccessInput.userId, workspaceAccessInput.workspaceId, "manage")
    ).rejects.toThrow("Unauthorized");
  });
});

describe("checkFeedbackDirectoryAccess", () => {
  test("returns the feedback directory ID when it belongs to the authorized workspace", async () => {
    await expect(checkFeedbackDirectoryAccess(accessInput)).resolves.toEqual({
      feedbackDirectoryId: "frd-1",
    });
    expect(mocks.can).toHaveBeenCalledWith(
      { type: "user", id: "user-1" },
      "feedbackDirectoryAssignment.read",
      {
        type: "feedbackDirectoryAssignment",
        feedbackDirectoryId: "frd-1",
        workspaceId: "workspace-1",
      }
    );
  });

  test("rejects inaccessible feedback record directories with an audit-safe warning", async () => {
    mocks.can.mockResolvedValue(false);

    await expect(checkFeedbackDirectoryAccess(accessInput)).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { source: "charts.executeQueryAction" },
      "Feedback directory access denied for Cube query"
    );
  });

  test("propagates operational failures without logging identifiers or raw errors", async () => {
    const error = new Error("database unavailable");
    mocks.can.mockRejectedValue(error);

    await expect(checkFeedbackDirectoryAccess(accessInput)).rejects.toThrow("database unavailable");
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });
});
