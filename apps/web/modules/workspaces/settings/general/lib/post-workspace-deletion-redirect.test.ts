import { describe, expect, test } from "vitest";
import { selectPostWorkspaceDeletionWorkspaceId } from "./post-workspace-deletion-redirect";

const workspace = (id: string, organizationId: string, createdAt: string) => ({
  id,
  organizationId,
  createdAt: new Date(createdAt),
});

const deleted = { id: "ws-deleted", organizationId: "org-1" };

describe("selectPostWorkspaceDeletionWorkspaceId", () => {
  test("returns the oldest remaining workspace of the same organization", () => {
    const workspaces = [
      workspace("ws-deleted", "org-1", "2024-01-01"),
      workspace("ws-newer", "org-1", "2024-03-01"),
      workspace("ws-older", "org-1", "2024-02-01"),
    ];

    expect(selectPostWorkspaceDeletionWorkspaceId(workspaces, deleted)).toBe("ws-older");
  });

  test("ignores workspaces of other organizations", () => {
    const workspaces = [
      workspace("ws-other-org", "org-2", "2023-01-01"),
      workspace("ws-deleted", "org-1", "2024-01-01"),
      workspace("ws-same-org", "org-1", "2024-02-01"),
    ];

    expect(selectPostWorkspaceDeletionWorkspaceId(workspaces, deleted)).toBe("ws-same-org");
  });

  test("returns null when only workspaces of other organizations remain", () => {
    const workspaces = [
      workspace("ws-deleted", "org-1", "2024-01-01"),
      workspace("ws-other-org", "org-2", "2023-01-01"),
    ];

    expect(selectPostWorkspaceDeletionWorkspaceId(workspaces, deleted)).toBeNull();
  });

  test("returns null when the deleted workspace was the last one", () => {
    expect(
      selectPostWorkspaceDeletionWorkspaceId([workspace("ws-deleted", "org-1", "2024-01-01")], deleted)
    ).toBeNull();
  });

  test("returns null for an empty workspace list", () => {
    expect(selectPostWorkspaceDeletionWorkspaceId([], deleted)).toBeNull();
  });

  test("does not mutate the given workspace list", () => {
    const workspaces = [
      workspace("ws-newer", "org-1", "2024-03-01"),
      workspace("ws-older", "org-1", "2024-02-01"),
    ];

    selectPostWorkspaceDeletionWorkspaceId(workspaces, deleted);

    expect(workspaces.map((entry) => entry.id)).toEqual(["ws-newer", "ws-older"]);
  });
});
