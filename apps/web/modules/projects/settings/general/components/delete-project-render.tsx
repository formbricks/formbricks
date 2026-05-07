"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { TProject } from "@formbricks/types/project";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@/lib/localStorage";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { truncate } from "@/lib/utils/strings";
import { deleteProjectAction } from "@/modules/projects/settings/general/actions";
import { hasMatchingWorkspaceDeleteConfirmation } from "@/modules/projects/settings/general/lib/delete-project-confirmation";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";

interface DeleteProjectRenderProps {
  isDeleteDisabled: boolean;
  isOwnerOrManager: boolean;
  currentProject: TProject;
  organizationProjects: TProject[];
}

export const DeleteProjectRender = ({
  isDeleteDisabled,
  isOwnerOrManager,
  currentProject,
  organizationProjects,
}: DeleteProjectRenderProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const hasValidConfirmation = hasMatchingWorkspaceDeleteConfirmation(confirmationName, currentProject.name);

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmationName("");
    }
    setIsDeleteDialogOpen(open);
  };

  const handleDeleteProject = async () => {
    if (!hasValidConfirmation) {
      return;
    }

    try {
      setIsDeleting(true);
      const deleteProjectResponse = await deleteProjectAction({
        projectId: currentProject.id,
        confirmationName,
      });

      if (deleteProjectResponse?.data) {
        if (organizationProjects.length === 1) {
          localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
        } else if (organizationProjects.length > 1) {
          // prevents changing of organization when deleting project
          const remainingProject = organizationProjects.find((project) => project.id !== currentProject.id);
          const productionEnvironment = remainingProject?.environments.find(
            (environment) => environment.type === "production"
          );
          if (productionEnvironment) {
            localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, productionEnvironment.id);
          }
        }
        toast.success(t("environments.workspace.general.workspace_deleted_successfully"));
        router.push("/");
      } else {
        const errorMessage = getFormattedErrorMessage(deleteProjectResponse);
        logger.error({ errorMessage, projectId: currentProject.id }, "Workspace deletion action failed");
        toast.error(errorMessage);
        handleDeleteDialogOpenChange(false);
      }
    } catch (error) {
      logger.error({ error, projectId: currentProject.id }, "Workspace deletion failed");
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
            {t(
              "environments.workspace.general.delete_workspace_name_includes_surveys_responses_people_and_more",
              {
                projectName: truncate(currentProject.name, 30),
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
        setOpen={handleDeleteDialogOpenChange}
        onDelete={handleDeleteProject}
        text={t("environments.workspace.general.delete_workspace_confirmation", {
          projectName: truncate(currentProject.name, 30),
        })}
        isDeleting={isDeleting}
        disabled={!hasValidConfirmation}>
        <div className="py-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await handleDeleteProject();
            }}>
            <label htmlFor="deleteProjectConfirmation">
              {t("environments.workspace.general.delete_workspace_confirmation_name", {
                projectName: currentProject.name,
              })}
            </label>
            <Input
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder={currentProject.name}
              className="mt-2"
              type="text"
              id="deleteProjectConfirmation"
              name="deleteProjectConfirmation"
            />
          </form>
        </div>
      </DeleteDialog>
    </div>
  );
};
