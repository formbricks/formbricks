import { getServerSession } from "next-auth";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TProject } from "@formbricks/types/project";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getUserProjects } from "@/lib/project/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { DeleteProjectRender } from "@/modules/projects/settings/general/components/delete-project-render";

interface DeleteProjectProps {
  environmentId: string;
  currentProject: TProject;
  organizationProjects: TProject[];
  isOwnerOrManager: boolean;
}

export const DeleteProject = async ({
  environmentId,
  currentProject,
  organizationProjects,
  isOwnerOrManager,
}: DeleteProjectProps) => {
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }
  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }
  const availableProjects = organization ? await getUserProjects(session.user.id, organization.id) : null;

  const availableProjectsLength = availableProjects ? availableProjects.length : 0;
  const isDeleteDisabled = availableProjectsLength <= 1 || !isOwnerOrManager;

  return (
    <DeleteProjectRender
      isDeleteDisabled={isDeleteDisabled}
      isOwnerOrManager={isOwnerOrManager}
      currentProject={currentProject}
      organizationProjects={organizationProjects}
    />
  );
};
