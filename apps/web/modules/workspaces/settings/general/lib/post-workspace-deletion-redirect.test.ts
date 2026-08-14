import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = {
  getOnboardingRedirectPath: vi.fn(),
};

vi.mock("@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete", () => ({
  getOnboardingRedirectPath: (...args: unknown[]) => mocks.getOnboardingRedirectPath(...args),
}));

const { getPostDeletionDestination, selectPostWorkspaceDeletionWorkspaceId } =
  await import("./post-workspace-deletion-redirect");

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

  test("breaks createdAt ties by id so the destination does not depend on query order", () => {
    const sameInstant = "2024-02-01";
    const workspaces = [
      workspace("ws-deleted", "org-1", "2024-01-01"),
      workspace("ws-b", "org-1", sameInstant),
      workspace("ws-a", "org-1", sameInstant),
    ];

    expect(selectPostWorkspaceDeletionWorkspaceId(workspaces, deleted)).toBe("ws-a");
    // getUserWorkspaces has no orderBy, so the same set can arrive in any order.
    expect(selectPostWorkspaceDeletionWorkspaceId([...workspaces].reverse(), deleted)).toBe("ws-a");
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

describe("getPostDeletionDestination", () => {
  afterEach(() => vi.clearAllMocks());

  const availableWorkspaces = [
    workspace("ws-deleted", "org-1", "2024-01-01"),
    workspace("ws-remaining", "org-1", "2024-02-01"),
  ];

  test("navigates to the surviving workspace when onboarding is complete", async () => {
    mocks.getOnboardingRedirectPath.mockResolvedValue(null);

    const destination = await getPostDeletionDestination({
      organizationId: "org-1",
      currentWorkspace: deleted,
      availableWorkspaces,
    });

    expect(destination).toEqual({ workspaceId: "ws-remaining", path: "/workspaces/ws-remaining/" });
    expect(mocks.getOnboardingRedirectPath).toHaveBeenCalledWith({
      organizationId: "org-1",
      workspace: availableWorkspaces[1],
    });
  });

  test('keeps the onboarding redirect the removed "/" hop used to run', async () => {
    mocks.getOnboardingRedirectPath.mockResolvedValue("/organizations/org-1/workspaces/new/survey");

    const destination = await getPostDeletionDestination({
      organizationId: "org-1",
      currentWorkspace: deleted,
      availableWorkspaces,
    });

    expect(destination).toEqual({
      workspaceId: "ws-remaining",
      path: "/organizations/org-1/workspaces/new/survey",
    });
  });

  test('falls back to "/" without checking onboarding when the organization has no workspace left', async () => {
    const destination = await getPostDeletionDestination({
      organizationId: "org-1",
      currentWorkspace: deleted,
      availableWorkspaces: [workspace("ws-other-org", "org-2", "2023-01-01")],
    });

    expect(destination).toEqual({ workspaceId: null, path: "/" });
    expect(mocks.getOnboardingRedirectPath).not.toHaveBeenCalled();
  });
});
