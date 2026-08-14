import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkFeedbackDirectoryAccess, checkWorkspaceAccess } from "./access";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  checkAuthorizationUpdated: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

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
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: workspaceAccessInput.workspaceId,
        },
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

describe("checkFeedbackDirectoryAccess", () => {
  test("returns the feedback directory ID when it belongs to the authorized workspace", async () => {
    await expect(checkFeedbackDirectoryAccess(accessInput)).resolves.toEqual({
      feedbackDirectoryId: "frd-1",
    });
    expect(mocks.can).toHaveBeenCalledWith(
      { type: "user", id: "user-1" },
      "feedbackDirectoryAssignment.read",
      { type: "feedbackDirectoryAssignment", id: "frd-1", workspaceId: "workspace-1" }
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
