import "server-only";
import { getOnboardingRedirectPath } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";

export interface TWorkspaceRedirectCandidate {
  id: string;
  organizationId: string;
  createdAt: Date;
}

/**
 * Picks the workspace to open after a workspace was deleted.
 *
 * Only workspaces of the deleted workspace's organization are considered: redirecting to "/" instead
 * resolves the last-visited workspace across *all* organizations the user belongs to, which drops
 * members of multiple organizations into an unrelated organization. The oldest remaining workspace is
 * used so the destination is stable regardless of the order the workspaces were queried in.
 *
 * Returns `null` when the organization has no other workspace left, in which case the caller has to
 * fall back to the organization-agnostic landing flow.
 */
export const selectPostWorkspaceDeletionWorkspaceId = (
  workspaces: TWorkspaceRedirectCandidate[],
  deletedWorkspace: Pick<TWorkspaceRedirectCandidate, "id" | "organizationId">
): string | null => {
  const remainingWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.id !== deletedWorkspace.id && workspace.organizationId === deletedWorkspace.organizationId
  );

  if (remainingWorkspaces.length === 0) {
    return null;
  }

  return [...remainingWorkspaces].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  )[0].id;
};

export interface TPostWorkspaceDeletionDestination {
  /** Workspace to remember as the last active one; `null` when the organization has none left. */
  workspaceId: string | null;
  /** Where to navigate once the deletion succeeded. */
  path: string;
}

/**
 * Resolves where the browser goes after a workspace was deleted.
 *
 * Deletion used to navigate to "/", whose onboarding gate sends owners and managers into the
 * new-workspace flow when the organization's oldest workspace has no survey yet. Only owners and
 * managers can delete a workspace, so navigating straight to the surviving workspace has to run the
 * same gate — otherwise deleting a workspace would be the one way to skip onboarding.
 *
 * Resolved on the server because the gate needs the survey count of the workspace we land on; the
 * deleted workspace does not affect that count, so it is safe to resolve before the deletion runs.
 */
export const getPostDeletionDestination = async ({
  organizationId,
  currentWorkspace,
  availableWorkspaces,
}: {
  organizationId: string;
  currentWorkspace: Pick<TWorkspaceRedirectCandidate, "id" | "organizationId">;
  availableWorkspaces: TWorkspaceRedirectCandidate[];
}): Promise<TPostWorkspaceDeletionDestination> => {
  const workspaceId = selectPostWorkspaceDeletionWorkspaceId(availableWorkspaces, currentWorkspace);
  const workspace = availableWorkspaces.find((candidate) => candidate.id === workspaceId);

  if (!workspace) {
    // Nothing left in this organization — the organization-agnostic landing flow takes over.
    return { workspaceId: null, path: "/" };
  }

  const onboardingPath = await getOnboardingRedirectPath({ organizationId, workspace });

  return { workspaceId: workspace.id, path: onboardingPath ?? `/workspaces/${workspace.id}/` };
};
