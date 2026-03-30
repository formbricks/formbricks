"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TWorkspace } from "@formbricks/types/workspace";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { truncate } from "@/lib/utils/strings";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { deleteWorkspaceAction } from "@/modules/workspaces/settings/general/actions";

interface DeleteWorkspaceRenderProps {
  isDeleteDisabled: boolean;
  isOwnerOrManager: boolean;
  currentWorkspace: TWorkspace;
  organizationWorkspaces: TWorkspace[];
}

export const DeleteWorkspaceRender = ({
  isDeleteDisabled,
  isOwnerOrManager,
  currentWorkspace,
  organizationWorkspaces,
}: DeleteWorkspaceRenderProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    const deleteWorkspaceResponse = await deleteWorkspaceAction({ workspaceId: currentWorkspace.id });
    if (deleteWorkspaceResponse?.data) {
      if (organizationWorkspaces.length === 1) {
        localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
      } else if (organizationWorkspaces.length > 1) {
        // prevents changing of organization when deleting workspace
        const remainingWorkspaces = organizationWorkspaces.filter(
          (workspace) => workspace.id !== currentWorkspace.id
        );
        const productionEnvironment = remainingWorkspaces[0].environments.find(
          (environment) => environment.type === "production"
        );
        if (productionEnvironment) {
          localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, productionEnvironment.id);
        }
      }
      toast.success(t("environments.workspace.general.workspace_deleted_successfully"));
      router.push("/");
    } else {
      const errorMessage = getFormattedErrorMessage(deleteWorkspaceResponse);
      toast.error(errorMessage);
      setIsDeleteDialogOpen(false);
    }
    setIsDeleting(false);
  };

  return (
    <div>
      {!isDeleteDisabled && (
        <div className="space-y-2">
          <p className="text-sm text-slate-900">
            {t(
              "environments.workspace.general.delete_workspace_name_includes_surveys_responses_people_and_more",
              {
                workspaceName: truncate(currentWorkspace.name, 30),
              }
            )}{" "}
            <strong>{t("environments.workspace.general.this_action_cannot_be_undone")}</strong>
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
        <Alert variant="warning">
          <AlertDescription>
            {!isOwnerOrManager
              ? t("environments.workspace.general.only_owners_or_managers_can_delete_workspaces")
              : t("environments.workspace.general.cannot_delete_only_workspace")}
          </AlertDescription>
        </Alert>
      )}

      <DeleteDialog
        deleteWhat={t("environments.settings.domain.workspace")}
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDeleteWorkspace}
        text={t("environments.workspace.general.delete_workspace_confirmation", {
          workspaceName: truncate(currentWorkspace.name, 30),
        })}
        isDeleting={isDeleting}
      />
    </div>
  );
};
