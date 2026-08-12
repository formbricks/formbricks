import { AuthenticationError } from "@formbricks/types/errors";
import { TWorkspace } from "@formbricks/types/workspace";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { DeleteWorkspaceRender } from "@/modules/workspaces/settings/general/components/delete-workspace-render";
import { getPostDeletionDestination } from "@/modules/workspaces/settings/general/lib/post-workspace-deletion-redirect";

interface DeleteWorkspaceProps {
  organizationId: string;
  currentWorkspace: TWorkspace;
  isOwnerOrManager: boolean;
}

export const DeleteWorkspace = async ({
  organizationId,
  currentWorkspace,
  isOwnerOrManager,
}: DeleteWorkspaceProps) => {
  const t = await getTranslate();
  const session = await getSession();
  if (!session) {
    throw new AuthenticationError(t("common.session_not_found"));
  }
  const availableWorkspaces = await getUserWorkspaces(session.user.id, organizationId);

  const availableWorkspacesLength = availableWorkspaces ? availableWorkspaces.length : 0;
  const isDeleteDisabled = availableWorkspacesLength <= 1 || !isOwnerOrManager;

  // Where the browser goes after the deletion succeeded. Resolved here, on the server, because
  // choosing it needs the survey count of the workspace we land on — see
  // getPostDeletionDestination.
  const { workspaceId: postDeletionWorkspaceId, path: postDeletionPath } = isDeleteDisabled
    ? { workspaceId: null, path: "/" }
    : await getPostDeletionDestination({
        organizationId,
        currentWorkspace,
        availableWorkspaces: availableWorkspaces ?? [],
      });

  return (
    <DeleteWorkspaceRender
      isDeleteDisabled={isDeleteDisabled}
      isOwnerOrManager={isOwnerOrManager}
      currentWorkspace={currentWorkspace}
      postDeletionWorkspaceId={postDeletionWorkspaceId}
      postDeletionPath={postDeletionPath}
    />
  );
};
