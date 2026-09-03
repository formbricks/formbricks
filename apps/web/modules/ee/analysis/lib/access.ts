import "server-only";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertCan, can } from "@/lib/authorization";
import {
  getFeedbackDirectoryAssignmentAuthorizationAction,
  getWorkspaceAuthorizationAction,
} from "@/lib/authorization/permission-action";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

export const checkWorkspaceAccess = async (
  userId: string,
  workspaceId: string,
  minPermission: TTeamPermission
) => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  await assertCan({ type: "user", id: userId }, getWorkspaceAuthorizationAction(minPermission), {
    type: "workspace",
    id: workspaceId,
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
    getFeedbackDirectoryAssignmentAuthorizationAction(minPermission),
    { type: "feedbackDirectoryAssignment", feedbackDirectoryId, workspaceId }
  );

  if (!allowed) {
    logger.warn({ source }, "Feedback directory access denied for Cube query");
    throw new AuthorizationError("Feedback directory is not accessible from this workspace");
  }

  return { feedbackDirectoryId };
};
