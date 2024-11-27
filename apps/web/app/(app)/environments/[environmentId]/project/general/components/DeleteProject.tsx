import { DeleteProjectRender } from "@/app/(app)/environments/[environmentId]/project/general/components/DeleteProjectRender";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUserProjects } from "@formbricks/lib/project/service";
import { TProject } from "@formbricks/types/project";

interface DeleteProjectProps {
  environmentId: string;
  project: TProject;
  isOwnerOrManager: boolean;
}

export const DeleteProject = async ({ environmentId, project, isOwnerOrManager }: DeleteProjectProps) => {
  const t = await getTranslations();
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
      project={project}
    />
  );
};
