import "server-only";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackRecordDirectoryAuthContext } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

export const checkWorkspaceAccess = async (
  userId: string,
  workspaceId: string,
  minPermission: TTeamPermission
) => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      { type: "organization", roles: ["owner", "manager"] },
      { type: "workspaceTeam", minPermission, workspaceId },
    ],
  });

  return { organizationId, workspaceId };
};

type TFeedbackRecordDirectoryAccessSource =
  | "charts.createChartAction"
  | "charts.executeQueryAction"
  | "charts.generateAIChartAction"
  | "dashboards.widget";

type TCheckFeedbackRecordDirectoryAccessInput = {
  feedbackRecordDirectoryId: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  source: TFeedbackRecordDirectoryAccessSource;
};

export const checkFeedbackRecordDirectoryAccess = async ({
  feedbackRecordDirectoryId,
  organizationId,
  workspaceId,
  userId,
  source,
}: TCheckFeedbackRecordDirectoryAccessInput): Promise<{ feedbackRecordDirectoryId: string }> => {
  try {
    const directory = await getFeedbackRecordDirectoryAuthContext(feedbackRecordDirectoryId);
    const isAccessible =
      directory?.organizationId === organizationId &&
      directory.workspaceIds.includes(workspaceId) &&
      !directory.isArchived;

    if (!isAccessible) {
      logger.warn(
        {
          feedbackRecordDirectoryId,
          organizationId,
          workspaceId,
          userId,
          source,
        },
        "Feedback record directory access denied for Cube query"
      );
      throw new AuthorizationError("Feedback record directory is not accessible from this workspace");
    }

    return { feedbackRecordDirectoryId };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    logger.error(
      {
        error,
        feedbackRecordDirectoryId,
        organizationId,
        workspaceId,
        userId,
        source,
      },
      "Failed to verify feedback record directory access for Cube query"
    );
    throw error;
  }
};
