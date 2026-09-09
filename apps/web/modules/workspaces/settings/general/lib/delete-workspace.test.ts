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
  getWorkspaces: vi.fn(),
  getPostDeletionDestination: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mocks.cookieSet, delete: mocks.cookieDelete }),
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: mocks.getWorkspace,
  getWorkspaces: mocks.getWorkspaces,
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
}));

vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  deleteWorkspaceIfNotLast: mocks.deleteWorkspaceIfNotLast,
}));

vi.mock("./post-workspace-deletion-redirect", () => ({
  getPostDeletionDestination: mocks.getPostDeletionDestination,
}));

const baseWorkspace = {
  id: "cmworkspace00000000000000000",
  name: "Acme Workspace",
  organizationId: "cmorg00000000000000000000",
};

const remainingWorkspace = { ...baseWorkspace, id: "cmworkspace2" };

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
    // Post-deletion read: the deleted row is already gone.
    mocks.getWorkspaces.mockResolvedValue([remainingWorkspace]);
    mocks.getPostDeletionDestination.mockResolvedValue({
      workspaceId: remainingWorkspace.id,
      path: `/workspaces/${remainingWorkspace.id}/`,
    });
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
    expect(result).toEqual({
      workspace: baseWorkspace,
      destination: { workspaceId: remainingWorkspace.id, path: `/workspaces/${remainingWorkspace.id}/` },
    });
  });

  test("resolves the destination after the deletion, from the surviving workspaces", async () => {
    await callDeleteWorkspaceWithConfirmation();

    // The freshly read surviving list is resolved only after the atomic deletion guard completes.
    expect(mocks.getPostDeletionDestination).toHaveBeenCalledWith({
      organizationId: baseWorkspace.organizationId,
      currentWorkspace: baseWorkspace,
      availableWorkspaces: [remainingWorkspace],
    });
    expect(mocks.getWorkspaces.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.deleteWorkspaceIfNotLast.mock.invocationCallOrder[0]
    );
    // The gate and the workspace list must be read after the row is gone, not when the page rendered.
    expect(mocks.deleteWorkspaceIfNotLast.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getPostDeletionDestination.mock.invocationCallOrder[0]
    );
  });

  test("points the workspace cookie at the destination so account settings keep the organization", async () => {
    await callDeleteWorkspaceWithConfirmation();

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "formbricks-workspace-id",
      remainingWorkspace.id,
      expect.objectContaining({ path: "/", httpOnly: true })
    );
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
  });

  test("clears the workspace cookie when the organization has no workspace left", async () => {
    mocks.getPostDeletionDestination.mockResolvedValueOnce({ workspaceId: null, path: "/" });

    const result = await callDeleteWorkspaceWithConfirmation();

    expect(mocks.cookieDelete).toHaveBeenCalledWith("formbricks-workspace-id");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(result.destination).toEqual({ workspaceId: null, path: "/" });
  });

  test('reports the deletion as successful with a "/" destination when resolving it fails', async () => {
    mocks.getPostDeletionDestination.mockRejectedValueOnce(new Error("survey count failed"));

    const result = await callDeleteWorkspaceWithConfirmation();

    // The workspace is already gone — a failed destination lookup must not surface as a failed delete.
    expect(result).toEqual({ workspace: baseWorkspace, destination: { workspaceId: null, path: "/" } });
  });

  test("clears the workspace cookie when resolving the destination fails", async () => {
    mocks.getPostDeletionDestination.mockRejectedValueOnce(new Error("survey count failed"));

    await callDeleteWorkspaceWithConfirmation();

    // Otherwise the cookie keeps naming the workspace we just deleted, disagreeing with the "/"
    // destination we return.
    expect(mocks.cookieDelete).toHaveBeenCalledWith("formbricks-workspace-id");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  test("still returns the destination when persisting the cookie fails", async () => {
    mocks.cookieSet.mockImplementationOnce(() => {
      throw new Error("cookie write failed");
    });

    const result = await callDeleteWorkspaceWithConfirmation();

    expect(result.destination).toEqual({
      workspaceId: remainingWorkspace.id,
      path: `/workspaces/${remainingWorkspace.id}/`,
    });
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
