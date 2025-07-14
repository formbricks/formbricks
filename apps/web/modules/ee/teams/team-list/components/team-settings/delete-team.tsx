"use client";

import { deleteTeamAction } from "@/modules/ee/teams/team-list/actions";
import { TTeam } from "@/modules/ee/teams/team-list/types/team";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface DeleteTeamProps {
  teamId: TTeam["id"];
  onDelete: () => void;
  isOwnerOrManager: boolean;
}

export const DeleteTeam = ({ teamId, onDelete, isOwnerOrManager }: DeleteTeamProps) => {
  const { t } = useTranslate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  const handleDeleteTeam = async () => {
    setIsDeleting(true);

    const deleteTeamActionResponse = await deleteTeamAction({ teamId });
    if (deleteTeamActionResponse?.data) {
      toast.success(t("environments.settings.teams.team_deleted_successfully"));
      onDelete?.();
      router.refresh();
    } else {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  return (
    <>
      <div className="flex flex-row items-baseline space-x-2">
        <Label htmlFor="deleteTeamButton">{t("common.danger_zone")}</Label>
        <TooltipRenderer
          shouldRender={!isOwnerOrManager}
          tooltipContent={t("environments.settings.teams.team_deletion_not_allowed")}
          className="w-auto">
          <Button
            variant="destructive"
            type="button"
            id="deleteTeamButton"
            className="w-auto"
            disabled={!isOwnerOrManager}
            onClick={() => setIsDeleteDialogOpen(true)}>
            {t("environments.settings.teams.delete_team")}
          </Button>
        </TooltipRenderer>
      </div>

      {isDeleteDialogOpen && (
        <DeleteDialog
          open={isDeleteDialogOpen}
          setOpen={setIsDeleteDialogOpen}
          deleteWhat={t("common.team")}
          text={t("environments.settings.teams.are_you_sure_you_want_to_delete_this_team")}
          onDelete={handleDeleteTeam}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
};
