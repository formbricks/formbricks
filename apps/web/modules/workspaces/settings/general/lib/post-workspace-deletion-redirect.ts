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
