import { authOptions } from "@/modules/auth/lib/authOptions";
import { DeleteProjectRender } from "@/modules/projects/settings/general/components/delete-project-render";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUserProjects } from "@formbricks/lib/project/service";
import { TProject } from "@formbricks/types/project";

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
    throw new Error(t("common.session_not_found"));
  }
  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
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
