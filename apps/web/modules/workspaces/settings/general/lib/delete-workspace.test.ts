import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolvePostWorkspaceDeletionDestination } from "./delete-workspace";

const mocks = vi.hoisted(() => ({
  getWorkspaces: vi.fn(),
  getPostDeletionDestination: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mocks.cookieSet, delete: mocks.cookieDelete }),
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspaces: mocks.getWorkspaces,
}));

vi.mock("./post-workspace-deletion-redirect", () => ({
  getPostDeletionDestination: mocks.getPostDeletionDestination,
}));

const deletedWorkspace = {
  id: "cmworkspace00000000000000000",
  organizationId: "cmorg00000000000000000000",
};

const remainingWorkspace = { ...deletedWorkspace, id: "cmworkspace2" };

describe("resolvePostWorkspaceDeletionDestination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Post-deletion read: the deleted row is already gone.
    mocks.getWorkspaces.mockResolvedValue([remainingWorkspace]);
    mocks.getPostDeletionDestination.mockResolvedValue({
      workspaceId: remainingWorkspace.id,
      path: `/workspaces/${remainingWorkspace.id}/`,
    });
  });

  test("resolves the destination from the organization's surviving workspaces", async () => {
    const destination = await resolvePostWorkspaceDeletionDestination(deletedWorkspace);

    expect(mocks.getWorkspaces).toHaveBeenCalledWith(deletedWorkspace.organizationId);
    expect(mocks.getPostDeletionDestination).toHaveBeenCalledWith({
      organizationId: deletedWorkspace.organizationId,
      currentWorkspace: deletedWorkspace,
      availableWorkspaces: [remainingWorkspace],
    });
    expect(destination).toEqual({
      workspaceId: remainingWorkspace.id,
      path: `/workspaces/${remainingWorkspace.id}/`,
    });
  });

  test("points the workspace cookie at the destination so account settings keep the organization", async () => {
    await resolvePostWorkspaceDeletionDestination(deletedWorkspace);

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "formbricks-workspace-id",
      remainingWorkspace.id,
      expect.objectContaining({ path: "/", httpOnly: true })
    );
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
  });

  test("clears the workspace cookie when the organization has no workspace left", async () => {
    mocks.getPostDeletionDestination.mockResolvedValueOnce({
      workspaceId: null,
      path: "/",
    });

    const destination = await resolvePostWorkspaceDeletionDestination(deletedWorkspace);

    expect(mocks.cookieDelete).toHaveBeenCalledWith("formbricks-workspace-id");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(destination).toEqual({ workspaceId: null, path: "/" });
  });

  test('falls back to "/" and clears the cookie when resolving the destination fails', async () => {
    mocks.getPostDeletionDestination.mockRejectedValueOnce(new Error("survey count failed"));

    const destination = await resolvePostWorkspaceDeletionDestination(deletedWorkspace);

    // The workspace is already gone — a failed destination lookup must not surface as a failed delete,
    // and the cookie must not keep naming the workspace just deleted.
    expect(destination).toEqual({ workspaceId: null, path: "/" });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("formbricks-workspace-id");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  test("still returns the destination when persisting the cookie fails", async () => {
    mocks.cookieSet.mockImplementationOnce(() => {
      throw new Error("cookie write failed");
    });

    const destination = await resolvePostWorkspaceDeletionDestination(deletedWorkspace);

    expect(destination).toEqual({
      workspaceId: remainingWorkspace.id,
      path: `/workspaces/${remainingWorkspace.id}/`,
    });
  });
});
