import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import {
  DELETE_WORKSPACE_CONFIRMATION_REQUIRED_ERROR,
  deleteWorkspaceWithConfirmation,
  getWorkspaceIdForLogging,
} from "./delete-workspace";
import { WORKSPACE_DELETE_CONFIRMATION_ERROR } from "./delete-workspace-confirmation";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  deleteWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  getUserWorkspaces: vi.fn(),
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: mocks.getWorkspace,
  getUserWorkspaces: mocks.getUserWorkspaces,
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  deleteWorkspace: mocks.deleteWorkspace,
}));

const baseWorkspace = {
  id: "cmworkspace00000000000000000",
  name: "Acme Workspace",
  organizationId: "cmorg00000000000000000000",
};

const userId = "cmuser00000000000000000000";

const callDeleteWorkspaceWithConfirmation = (input = {}) =>
  deleteWorkspaceWithConfirmation({
    input: {
      workspaceId: baseWorkspace.id,
      confirmationName: baseWorkspace.name,
      ...input,
    },
    userId,
    auditLoggingCtx: {},
  });

describe("deleteWorkspaceWithConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getWorkspace.mockResolvedValue(baseWorkspace);
    mocks.getUserWorkspaces.mockResolvedValue([baseWorkspace, { ...baseWorkspace, id: "cmworkspace2" }]);
    mocks.deleteWorkspace.mockResolvedValue(baseWorkspace);
  });

  test("deletes a workspace when the confirmation name matches", async () => {
    const auditLoggingCtx = {};

    const result = await deleteWorkspaceWithConfirmation({
      input: {
        workspaceId: baseWorkspace.id,
        confirmationName: "acme workspace",
      },
      userId,
      auditLoggingCtx,
    });

    expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId,
      organizationId: baseWorkspace.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });
    expect(mocks.getUserWorkspaces).toHaveBeenCalledWith(userId, baseWorkspace.organizationId);
    expect(mocks.deleteWorkspace).toHaveBeenCalledWith(baseWorkspace.id);
    expect(auditLoggingCtx).toMatchObject({
      organizationId: baseWorkspace.organizationId,
      workspaceId: baseWorkspace.id,
      oldObject: baseWorkspace,
    });
    expect(result).toEqual(baseWorkspace);
  });

  test("rejects invalid input before any workspace lookup", async () => {
    await expect(
      deleteWorkspaceWithConfirmation({
        input: {},
        userId,
        auditLoggingCtx: {},
      })
    ).rejects.toThrow(InvalidInputError);
    await expect(
      deleteWorkspaceWithConfirmation({
        input: {},
        userId,
        auditLoggingCtx: {},
      })
    ).rejects.toThrow(DELETE_WORKSPACE_CONFIRMATION_REQUIRED_ERROR);

    expect(mocks.getWorkspace).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled();
  });

  test("does not delete when the confirmation name does not match", async () => {
    const deleteAttempt = callDeleteWorkspaceWithConfirmation({ confirmationName: "Other Workspace" });

    await expect(deleteAttempt).rejects.toThrow(InvalidInputError);
    await expect(deleteAttempt).rejects.toThrow(WORKSPACE_DELETE_CONFIRMATION_ERROR);

    expect(mocks.checkAuthorizationUpdated).not.toHaveBeenCalled();
    expect(mocks.getUserWorkspaces).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled();
  });

  test("does not delete when the workspace cannot be found", async () => {
    mocks.getWorkspace.mockResolvedValueOnce(null);

    await expect(callDeleteWorkspaceWithConfirmation()).rejects.toThrow(ResourceNotFoundError);

    expect(mocks.checkAuthorizationUpdated).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled();
  });

  test("does not delete when authorization fails", async () => {
    mocks.checkAuthorizationUpdated.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(callDeleteWorkspaceWithConfirmation()).rejects.toThrow(AuthorizationError);

    expect(mocks.getUserWorkspaces).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspace).not.toHaveBeenCalled();
  });

  test("does not delete the last available workspace", async () => {
    mocks.getUserWorkspaces.mockResolvedValueOnce([baseWorkspace]);

    await expect(callDeleteWorkspaceWithConfirmation()).rejects.toThrow(OperationNotAllowedError);

    expect(mocks.deleteWorkspace).not.toHaveBeenCalled();
  });

  test("rethrows downstream delete failures", async () => {
    const error = new Error("delete failed");
    mocks.deleteWorkspace.mockRejectedValueOnce(error);

    await expect(callDeleteWorkspaceWithConfirmation()).rejects.toThrow(error);
  });
});

describe("getWorkspaceIdForLogging", () => {
  test("returns the workspace id when present", () => {
    expect(getWorkspaceIdForLogging({ workspaceId: baseWorkspace.id })).toBe(baseWorkspace.id);
  });

  test("returns unknown when the workspace id is missing or invalid", () => {
    expect(getWorkspaceIdForLogging({})).toBe("unknown");
    expect(getWorkspaceIdForLogging({ workspaceId: 123 })).toBe("unknown");
    expect(getWorkspaceIdForLogging(null)).toBe("unknown");
  });
});
