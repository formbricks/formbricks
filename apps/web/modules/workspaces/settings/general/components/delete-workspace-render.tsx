"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { TWorkspace } from "@formbricks/types/workspace";
import { FORMBRICKS_ENVIRONMENT_ID_LS, FORMBRICKS_WORKSPACE_ID_LS } from "@/lib/localStorage";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { truncate } from "@/lib/utils/strings";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { deleteWorkspaceAction } from "@/modules/workspaces/settings/general/actions";
import { hasMatchingWorkspaceDeleteConfirmation } from "@/modules/workspaces/settings/general/lib/delete-workspace-confirmation";

interface DeleteWorkspaceRenderProps {
  isDeleteDisabled: boolean;
  isOwnerOrManager: boolean;
  currentWorkspace: TWorkspace;
  // Post-deletion destination, resolved on the server by getPostDeletionDestination: the workspace to
  // remember as the last active one, and the path to navigate to.
  postDeletionWorkspaceId: string | null;
  postDeletionPath: string;
}

export const DeleteWorkspaceRender = ({
  isDeleteDisabled,
  isOwnerOrManager,
  currentWorkspace,
  postDeletionWorkspaceId,
  postDeletionPath,
}: DeleteWorkspaceRenderProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const hasValidConfirmation = hasMatchingWorkspaceDeleteConfirmation(
    confirmationName,
    currentWorkspace.name
  );

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmationName("");
    }
    setIsDeleteDialogOpen(open);
  };

  const handleDeleteWorkspace = async () => {
    if (!hasValidConfirmation) {
      return;
    }

    try {
      setIsDeleting(true);
      const deleteWorkspaceResponse = await deleteWorkspaceAction({
        workspaceId: currentWorkspace.id,
        confirmationName,
      });

      if (deleteWorkspaceResponse?.data) {
        // Navigate to a remaining workspace of the same organization instead of "/", which resolves the
        // last-visited workspace across every organization and would drop members of multiple
        // organizations into an unrelated one.
        if (postDeletionWorkspaceId) {
          localStorage.setItem(FORMBRICKS_WORKSPACE_ID_LS, postDeletionWorkspaceId);
          // Keep legacy environment ID in sync for backward compatibility with old SDK clients
          localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, postDeletionWorkspaceId);
        } else {
          localStorage.removeItem(FORMBRICKS_WORKSPACE_ID_LS);
          localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
        }

        toast.success(t("workspace.general.workspace_deleted_successfully"));
        router.push(postDeletionPath);
      } else {
        const errorMessage = getFormattedErrorMessage(deleteWorkspaceResponse);
        logger.error({ errorMessage, workspaceId: currentWorkspace.id }, "Workspace deletion action failed");
        toast.error(errorMessage);
        handleDeleteDialogOpenChange(false);
      }
    } catch (error) {
      logger.error({ error, workspaceId: currentWorkspace.id }, "Workspace deletion failed");
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {!isDeleteDisabled && (
        <div className="space-y-2">
          <p className="text-sm text-slate-900">
            {t("workspace.general.delete_workspace_name_includes_surveys_responses_people_and_more", {
              workspaceName: truncate(currentWorkspace.name, 30),
            })}{" "}
            <strong>{t("workspace.general.this_action_cannot_be_undone")}</strong>
          </p>
          <Button
            disabled={isDeleteDisabled}
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}>
            {t("common.delete")}
          </Button>
        </div>
      )}

      {isDeleteDisabled && (
        <Alert variant="warning" role="status">
          <AlertDescription>
            {!isOwnerOrManager
              ? t("workspace.general.only_owners_or_managers_can_delete_workspaces")
              : t("workspace.general.cannot_delete_only_workspace")}
          </AlertDescription>
        </Alert>
      )}

      <DeleteDialog
        deleteWhat={t("workspace.settings.domain.workspace")}
        open={isDeleteDialogOpen}
        setOpen={handleDeleteDialogOpenChange}
        onDelete={handleDeleteWorkspace}
        text={t("workspace.general.delete_workspace_confirmation", {
          workspaceName: truncate(currentWorkspace.name, 30),
        })}
        isDeleting={isDeleting}
        disabled={!hasValidConfirmation}>
        <div className="py-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await handleDeleteWorkspace();
            }}>
            <label htmlFor="deleteWorkspaceConfirmation">
              {t("workspace.general.delete_workspace_confirmation_name", {
                workspaceName: currentWorkspace.name,
              })}
            </label>
            <Input
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder={currentWorkspace.name}
              className="mt-2"
              type="text"
              id="deleteWorkspaceConfirmation"
              name="deleteWorkspaceConfirmation"
            />
          </form>
        </div>
      </DeleteDialog>
    </div>
  );
};
