import "server-only";
import { TWorkspace } from "@formbricks/types/workspace";
import { getOnboardingRedirectPath } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";

export type TWorkspaceRedirectCandidate = Pick<TWorkspace, "id" | "organizationId" | "createdAt">;

/**
 * Picks the workspace to open after a workspace was deleted.
 *
 * Only workspaces of the deleted workspace's organization are considered: redirecting to "/" instead
 * resolves the last-visited workspace across *all* organizations the user belongs to, which drops
 * members of multiple organizations into an unrelated organization. The oldest remaining workspace is
 * used, with the id as tie-break: `getUserWorkspaces` has no `orderBy`, and workspaces seeded in one
 * request share `createdAt` to the millisecond, so without the tie-break two calls could pick
 * different destinations — and with them different onboarding-gate outcomes.
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
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id)
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
 * Called from the delete action, *after* the deletion, so both the surviving-workspace list and the
 * gate's survey count are read at the moment we navigate. Resolving this when the settings page
 * rendered instead would freeze both into the page: the chosen workspace could have been deleted in
 * the meantime (landing the user on an error page right after a successful delete), and the gate's
 * answer could be stale (skipping onboarding for a workspace whose last survey was since removed).
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
