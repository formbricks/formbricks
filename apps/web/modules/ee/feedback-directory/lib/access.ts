import "server-only";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getAccessibleWorkspaceIds, getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getFeedbackDirectoryAuthContext } from "./feedback-directory";

/**
 * Org-context authorization guards for Unify Feedback surfaces (Feedback Datasets/Records/Topics)
 * that now live under org settings instead of a workspace URL.
 *
 * These reproduce the pre-relocation access outcomes: a feedback directory (dataset) is org-owned
 * but VIEW access has always been granted through workspace membership. The workspace URL used to
 * carry that scope; now these guards reconstruct it explicitly from the dataset's workspace
 * assignments intersected with the workspaces the user can reach.
 *
 * Modeled on {@link file://../analysis/lib/access.ts} `checkFeedbackDirectoryAccess`.
 */

/**
 * VIEW tier: owner/manager OR the dataset shares at least one workspace with the workspaces the
 * user can reach. Returns the dataset's assigned workspace ids so callers can derive a workspace
 * without re-fetching. Denies with a uniform {@link ResourceNotFoundError} — an unknown dataset,
 * a wrong-org dataset, and "exists but the user has no shared workspace" are indistinguishable, so
 * the guard is not an existence oracle.
 *
 * Archive state is intentionally not checked here: the pre-relocation record/taxonomy read paths
 * never rejected archived datasets, so blocking them would silently narrow current access.
 */
export const assertCanViewDirectory = async (
  userId: string,
  organizationId: string,
  directoryId: string
): Promise<{ organizationId: string; workspaceIds: string[] }> => {
  const authContext = await getFeedbackDirectoryAuthContext(directoryId);
  if (!authContext || authContext.organizationId !== organizationId) {
    throw new ResourceNotFoundError("Feedback directory", directoryId);
  }

  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) {
    throw new ResourceNotFoundError("Feedback directory", directoryId);
  }

  const { isOwner, isManager } = getAccessFlags(membership.role);
  if (isOwner || isManager) {
    return { organizationId, workspaceIds: authContext.workspaceIds };
  }

  const accessibleWorkspaceIds = new Set(await getAccessibleWorkspaceIds(userId, organizationId));
  const sharesWorkspace = authContext.workspaceIds.some((workspaceId) =>
    accessibleWorkspaceIds.has(workspaceId)
  );
  if (!sharesWorkspace) {
    throw new ResourceNotFoundError("Feedback directory", directoryId);
  }

  return { organizationId, workspaceIds: authContext.workspaceIds };
};

/**
 * MANAGE tier: creating/assigning/archiving datasets stays owner/manager-only, matching the
 * pre-relocation org Feedback Directories settings page.
 */
export const assertCanManageDirectory = async (userId: string, organizationId: string): Promise<void> => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  const { isOwner, isManager } = getAccessFlags(membership?.role);
  if (!isOwner && !isManager) {
    throw new AuthorizationError("Not authorized");
  }
};

/**
 * WRITE tier (manual records, taxonomy runs): owner/manager, OR a member with readWrite/manage on
 * at least one workspace the dataset is assigned to that the user can also reach. Preserves the
 * pre-relocation rule that writing required readWrite on the (then URL-scoped) workspace.
 */
export const assertCanWriteDirectoryRecords = async (
  userId: string,
  organizationId: string,
  directoryId: string
): Promise<void> => {
  const { workspaceIds } = await assertCanViewDirectory(userId, organizationId, directoryId);

  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  const { isOwner, isManager } = getAccessFlags(membership?.role);
  if (isOwner || isManager) return;

  const accessibleWorkspaceIds = new Set(await getAccessibleWorkspaceIds(userId, organizationId));
  const writableAssignedWorkspaceIds = workspaceIds.filter((workspaceId) =>
    accessibleWorkspaceIds.has(workspaceId)
  );
  const permissions = await Promise.all(
    writableAssignedWorkspaceIds.map((workspaceId) => getWorkspacePermissionByUserId(userId, workspaceId))
  );
  const hasWriteAccess = permissions.some(
    (permission) => permission === "readWrite" || permission === "manage"
  );
  if (!hasWriteAccess) {
    throw new AuthorizationError("Not authorized");
  }
};

/**
 * Guards that a dataset is actually assigned to the given workspace (and, when provided, owned by
 * the given organization). Used when creating a feedback source to close the pre-existing
 * same-org-only loophole — a source must target a dataset assigned to its own workspace so it
 * cannot write records into a dataset no workspace can read.
 */
export const assertDirectoryAssignedToWorkspace = async (
  directoryId: string,
  workspaceId: string,
  organizationId?: string
): Promise<void> => {
  const authContext = await getFeedbackDirectoryAuthContext(directoryId);
  if (
    !authContext ||
    (organizationId !== undefined && authContext.organizationId !== organizationId) ||
    !authContext.workspaceIds.includes(workspaceId)
  ) {
    throw new AuthorizationError("Invalid feedback directory");
  }
};
