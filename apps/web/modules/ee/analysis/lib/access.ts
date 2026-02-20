import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironment } from "@/lib/environment/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";

export const checkProjectAccess = async (
  userId: string,
  environmentId: string,
  minPermission: TTeamPermission
) => {
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new ResourceNotFoundError("environment", environmentId);
  }

  const projectId = environment.projectId;
  const organizationId = await getOrganizationIdFromProjectId(projectId);

  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      { type: "organization", roles: ["owner", "manager"] },
      { type: "projectTeam", minPermission, projectId },
    ],
  });

  return { organizationId, projectId };
};
