import "server-only";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { getFeedbackDirectoryAssignmentActionForPermission } from "@/lib/authorization/compatibility";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
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
  | "charts.getDimensionValuesAction"
  | "dashboards.widget";

type TCheckFeedbackDirectoryAccessInput = {
  feedbackDirectoryId: string;
  workspaceId: string;
  userId: string;
  minPermission: TTeamPermission;
  source: TFeedbackDirectoryAccessSource;
};

export const checkFeedbackDirectoryAccess = async ({
  feedbackDirectoryId,
  workspaceId,
  userId,
  minPermission,
  source,
}: TCheckFeedbackDirectoryAccessInput): Promise<{ feedbackDirectoryId: string }> => {
  const allowed = await can(
    { type: "user", id: userId },
    getFeedbackDirectoryAssignmentActionForPermission(minPermission),
    { type: "feedbackDirectoryAssignment", id: feedbackDirectoryId, workspaceId }
  );

  if (!allowed) {
    logger.warn({ source }, "Feedback directory access denied for Cube query");
    throw new AuthorizationError("Feedback directory is not accessible from this workspace");
  }

  return { feedbackDirectoryId };
};
