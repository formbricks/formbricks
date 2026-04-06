import { getServerSession } from "next-auth";
import { TWorkspace } from "@formbricks/types/workspace";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { DeleteWorkspaceRender } from "@/modules/workspaces/settings/general/components/delete-workspace-render";

interface DeleteWorkspaceProps {
  organizationId: string;
  currentWorkspace: TWorkspace;
  organizationWorkspaces: TWorkspace[];
  isOwnerOrManager: boolean;
}

export const DeleteWorkspace = async ({
  organizationId,
  currentWorkspace,
  organizationWorkspaces,
  isOwnerOrManager,
}: DeleteWorkspaceProps) => {
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const availableWorkspaces = await getUserWorkspaces(session.user.id, organizationId);

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
