import "server-only";
import { prisma } from "@formbricks/database";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

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

export const verifyFeedbackDirectoryAccess = async (
  feedbackDirectoryId: string,
  workspaceId: string
): Promise<void> => {
  const link = await prisma.feedbackDirectoryWorkspace.findFirst({
    where: {
      feedbackDirectoryId,
      workspaceId,
      feedbackDirectory: { isArchived: false },
    },
    select: { feedbackDirectoryId: true },
  });
  if (!link) {
    throw new AuthorizationError("Feedback directory not accessible from this workspace");
  }
};
