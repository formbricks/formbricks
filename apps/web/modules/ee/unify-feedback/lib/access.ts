import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";

/** Ids of the feedback directories (Hub tenants) assigned to a workspace. */
export const getWorkspaceDirectoryIds = async (workspaceId: string): Promise<Set<string>> => {
  const directories = await getFeedbackDirectoriesByWorkspaceId(workspaceId);
  return new Set(directories.map((directory) => directory.id));
};

/**
 * Guard that a feedback record is reachable from a workspace at all: its `tenant_id` must be one of
 * the directories assigned to that workspace. A directory belongs to exactly one organization, so
 * this is the cross-organization boundary, and it holds no matter who is allowed to act on the record
 * (deleting additionally requires an organization owner/manager — see ENG-1770).
 *
 * Throws a "not found" rather than a "forbidden" on purpose: a distinguishable response would let a
 * caller probe which record ids exist elsewhere.
 */
export const assertRecordBelongsToWorkspace = (
  directoryIds: Set<string>,
  tenantId: string,
  recordId: string | null
): void => {
  if (!directoryIds.has(tenantId)) {
    throw new ResourceNotFoundError("Feedback record", recordId);
  }
};
