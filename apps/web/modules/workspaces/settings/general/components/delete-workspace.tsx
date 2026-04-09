import { getServerSession } from "next-auth";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TWorkspace } from "@formbricks/types/workspace";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { DeleteWorkspaceRender } from "@/modules/workspaces/settings/general/components/delete-workspace-render";

interface DeleteWorkspaceProps {
  environmentId: string;
  currentWorkspace: TWorkspace;
  organizationWorkspaces: TWorkspace[];
  isOwnerOrManager: boolean;
}

export const DeleteWorkspace = async ({
  environmentId,
  currentWorkspace,
  organizationWorkspaces,
  isOwnerOrManager,
}: DeleteWorkspaceProps) => {
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError(t("common.session_not_found"));
  }
  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }
  const availableWorkspaces = organization ? await getUserWorkspaces(session.user.id, organization.id) : null;

  const availableWorkspacesLength = availableWorkspaces ? availableWorkspaces.length : 0;
  const isDeleteDisabled = availableWorkspacesLength <= 1 || !isOwnerOrManager;

  return (
    <DeleteWorkspaceRender
      isDeleteDisabled={isDeleteDisabled}
      isOwnerOrManager={isOwnerOrManager}
      currentWorkspace={currentWorkspace}
      organizationWorkspaces={organizationWorkspaces}
    />
  );
};
