import "server-only";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { listFeedbackRecords } from "@/modules/hub/service";

export const hasFeedbackRecordsInDirectories = async (directoryIds: string[]): Promise<boolean> => {
  if (directoryIds.length === 0) {
    return false;
  }

  const results = await Promise.all(
    directoryIds.map((directoryId) => listFeedbackRecords({ tenant_id: directoryId, limit: 1 }))
  );

  const hasRecords = results.some((result) => (result.data?.data?.length ?? 0) > 0);
  if (hasRecords) {
    return true;
  }

  const hasErrors = results.some((result) => Boolean(result.error));

  // Do not lock creation flows when record availability is unknown.
  return hasErrors;
};

export const hasWorkspaceFeedbackRecords = async (workspaceId: string): Promise<boolean> => {
  const directories = await getFeedbackDirectoriesByWorkspaceId(workspaceId);

  return hasFeedbackRecordsInDirectories(directories.map((directory) => directory.id));
};
