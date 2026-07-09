import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { hasFeedbackRecordsInDirectories } from "@/modules/ee/analysis/lib/feedback-records";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";

export async function getFeedbackDataAvailability(workspaceId: string) {
  const [directories, feedbackSources] = await Promise.all([
    getFeedbackDirectoriesByWorkspaceId(workspaceId),
    getFeedbackSourcesWithMappings(workspaceId),
  ]);

  if (directories.length === 0) {
    return { status: "no-directory" as const, directories, feedbackSources };
  }

  const hasFeedbackRecords = await hasFeedbackRecordsInDirectories(
    directories.map((directory) => directory.id)
  );

  return {
    status: hasFeedbackRecords ? ("ready" as const) : ("no-records" as const),
    directories,
    feedbackSources,
    hasFeedbackRecords,
  };
}
