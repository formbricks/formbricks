"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteProjectAction } from "@/modules/projects/settings/general/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@formbricks/lib/localStorage";
import { truncate } from "@formbricks/lib/utils/strings";
import { TProject } from "@formbricks/types/project";

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
  const { t } = useTranslate();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteProject = async () => {
    setIsDeleting(true);
    const deleteProjectResponse = await deleteProjectAction({ projectId: currentProject.id });
    if (deleteProjectResponse?.data) {
      if (organizationProjects.length === 1) {
        localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
      } else if (organizationProjects.length > 1) {
        // prevents changing of organization when deleting project
        const remainingProjects = organizationProjects.filter((project) => project.id !== currentProject.id);
        const productionEnvironment = remainingProjects[0].environments.find(
          (environment) => environment.type === "production"
        );
        if (productionEnvironment) {
          localStorage.setItem(FORMBRICKS_ENVIRONMENT_ID_LS, productionEnvironment.id);
        }
      }
      toast.success(t("environments.project.general.project_deleted_successfully"));
      router.push("/");
    } else {
      const errorMessage = getFormattedErrorMessage(deleteProjectResponse);
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
              "environments.project.general.delete_project_name_includes_surveys_responses_people_and_more",
              {
                projectName: truncate(currentProject.name, 30),
              }
            )}{" "}
            <strong>{t("environments.project.general.this_action_cannot_be_undone")}</strong>
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
              ? t("environments.project.general.only_owners_or_managers_can_delete_projects")
              : t("environments.project.general.cannot_delete_only_project")}
          </AlertDescription>
        </Alert>
      )}

      <DeleteDialog
        deleteWhat="Project"
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDeleteProject}
        text={t("environments.project.general.delete_project_confirmation", {
          projectName: truncate(currentProject.name, 30),
        })}
        isDeleting={isDeleting}
      />
    </div>
  );
};
