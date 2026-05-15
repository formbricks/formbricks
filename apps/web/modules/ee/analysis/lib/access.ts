import "server-only";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackDirectoryAuthContext } from "@/modules/ee/feedback-directory/lib/feedback-directory";
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

type TFeedbackDirectoryAccessSource =
  | "charts.createChartAction"
  | "charts.executeQueryAction"
  | "charts.generateAIChartAction"
  | "dashboards.widget";

type TCheckFeedbackDirectoryAccessInput = {
  feedbackDirectoryId: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  source: TFeedbackDirectoryAccessSource;
};

export const checkFeedbackDirectoryAccess = async ({
  feedbackDirectoryId,
  organizationId,
  workspaceId,
  userId,
  source,
}: TCheckFeedbackDirectoryAccessInput): Promise<{ feedbackDirectoryId: string }> => {
  try {
    const directory = await getFeedbackDirectoryAuthContext(feedbackDirectoryId);
    const isAccessible =
      directory?.organizationId === organizationId &&
      directory.workspaceIds.includes(workspaceId) &&
      !directory.isArchived;

    if (!isAccessible) {
      logger.warn(
        {
          feedbackDirectoryId,
          organizationId,
          workspaceId,
          userId,
          source,
        },
        "Feedback directory access denied for Cube query"
      );
      throw new AuthorizationError("Feedback directory is not accessible from this workspace");
    }

    return { feedbackDirectoryId };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    logger.error(
      {
        error,
        feedbackDirectoryId,
        organizationId,
        workspaceId,
        userId,
        source,
      },
      "Failed to verify feedback directory access for Cube query"
    );
    throw error;
  }
};
