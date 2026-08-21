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
  assertCan: vi.fn(),
  deleteWorkspaceIfNotLast: vi.fn(),
  getWorkspace: vi.fn(),
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: mocks.getWorkspace,
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
}));

vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  deleteWorkspaceIfNotLast: mocks.deleteWorkspaceIfNotLast,
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
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getWorkspace.mockResolvedValue(baseWorkspace);
    mocks.deleteWorkspaceIfNotLast.mockResolvedValue(baseWorkspace);
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

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: userId }, "organization.manage", {
      type: "organization",
      id: baseWorkspace.organizationId,
    });
    expect(mocks.deleteWorkspaceIfNotLast).toHaveBeenCalledWith(
      baseWorkspace.id,
      baseWorkspace.organizationId
    );
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
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });

  test("does not delete when the confirmation name does not match", async () => {
    const deleteAttempt = callDeleteWorkspaceWithConfirmation({ confirmationName: "Other Workspace" });

    await expect(deleteAttempt).rejects.toThrow(InvalidInputError);
    await expect(deleteAttempt).rejects.toThrow(WORKSPACE_DELETE_CONFIRMATION_ERROR);

    expect(mocks.assertCan).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });

  test("does not delete when the workspace cannot be found", async () => {
    mocks.getWorkspace.mockResolvedValueOnce(null);

    await expect(callDeleteWorkspaceWithConfirmation()).rejects.toThrow(ResourceNotFoundError);

    expect(mocks.assertCan).not.toHaveBeenCalled();
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });

  test("does not delete when authorization fails", async () => {
    mocks.assertCan.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(callDeleteWorkspaceWithConfirmation()).rejects.toThrow(AuthorizationError);

    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });

  test("does not delete the last available workspace", async () => {
    mocks.deleteWorkspaceIfNotLast.mockRejectedValueOnce(
      new OperationNotAllowedError("You can't delete the last workspace.")
    );

    await expect(callDeleteWorkspaceWithConfirmation()).rejects.toThrow(OperationNotAllowedError);

    expect(mocks.deleteWorkspaceIfNotLast).toHaveBeenCalledWith(
      baseWorkspace.id,
      baseWorkspace.organizationId
    );
  });

  test("rethrows downstream delete failures", async () => {
    const error = new Error("delete failed");
    mocks.deleteWorkspaceIfNotLast.mockRejectedValueOnce(error);

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
