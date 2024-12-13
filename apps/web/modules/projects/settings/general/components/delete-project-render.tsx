"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteProjectAction } from "@/modules/projects/settings/general/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { FORMBRICKS_ENVIRONMENT_ID_LS } from "@formbricks/lib/localStorage";
import { truncate } from "@formbricks/lib/utils/strings";
import { TProject } from "@formbricks/types/project";

interface DeleteProjectRenderProps {
  isDeleteDisabled: boolean;
  isOwnerOrManager: boolean;
  project: TProject;
}

export const DeleteProjectRender = ({
  isDeleteDisabled,
  isOwnerOrManager,
  project,
}: DeleteProjectRenderProps) => {
  const t = useTranslations();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteProject = async () => {
    setIsDeleting(true);
    const deleteProjectResponse = await deleteProjectAction({ projectId: project.id });
    if (deleteProjectResponse?.data) {
      localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
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
                projectName: truncate(project.name, 30),
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
          projectName: truncate(project.name, 30),
        })}
        isDeleting={isDeleting}
      />
    </div>
  );
};
