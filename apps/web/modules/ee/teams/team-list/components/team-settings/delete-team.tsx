"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { deleteTeam } from "@/modules/ee/teams/team-list/lib/api-client";
import { TTeam } from "@/modules/ee/teams/team-list/types/team";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface DeleteTeamProps {
  teamId: TTeam["id"];
  onDelete: () => void;
  isOwnerOrManager: boolean;
}

export const DeleteTeam = ({ teamId, onDelete, isOwnerOrManager }: DeleteTeamProps) => {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  const handleDeleteTeam = async () => {
    setIsDeleting(true);

    try {
      await deleteTeam(teamId);
      toast.success(t("workspace.settings.teams.team_deleted_successfully"));
      onDelete?.();
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }

    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  return (
    <>
      <div className="flex flex-row items-baseline gap-x-2">
        <TooltipRenderer
          shouldRender={!isOwnerOrManager}
          tooltipContent={t("workspace.settings.teams.team_deletion_not_allowed")}
          className="w-auto">
          <Button
            variant="destructive"
            type="button"
            id="deleteTeamButton"
            className="w-auto"
            disabled={!isOwnerOrManager}
            onClick={() => setIsDeleteDialogOpen(true)}>
            {t("workspace.settings.teams.delete_team")}
          </Button>
        </TooltipRenderer>
      </div>

      {isDeleteDialogOpen && (
        <DeleteDialog
          open={isDeleteDialogOpen}
          setOpen={setIsDeleteDialogOpen}
          deleteWhat={t("common.team")}
          text={t("workspace.settings.teams.are_you_sure_you_want_to_delete_this_team")}
          onDelete={handleDeleteTeam}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
};
