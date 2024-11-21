"use client";

import { deleteTeamAction } from "@/modules/ee/teams/team-details/actions";
import { TTeam } from "@/modules/ee/teams/team-details/types/teams";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface DeleteTeamProps {
  teamId: TTeam["id"];
  membershipRole?: TOrganizationRole;
}

export const DeleteTeam = ({ teamId, membershipRole }: DeleteTeamProps) => {
  const t = useTranslations();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  const handleDeleteTeam = async () => {
    setIsDeleting(true);

    const deleteTeamActionResponse = await deleteTeamAction({ teamId });
    if (deleteTeamActionResponse?.data) {
      toast.success(t("environments.settings.teams.team_deleted_successfully"));
      router.push("./");
    } else {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  const { isMember } = getAccessFlags(membershipRole);

  const isDeleteDisabled = isMember;

  return (
    <div>
      {isDeleteDisabled ? (
        <p className="text-sm text-red-700">
          {t("common.only_organization_owners_and_managers_can_access_this_setting")}
        </p>
      ) : (
        <div>
          <p className="text-sm text-slate-900">
            {t("environments.settings.teams.this_action_cannot_be_undone_if_it_s_gone_it_s_gone")}
          </p>
          <Button
            size="sm"
            disabled={isDeleteDisabled}
            variant="warn"
            className={`mt-4 ${isDeleteDisabled ? "ring-grey-500 ring-1 ring-offset-1" : ""}`}
            onClick={() => setIsDeleteDialogOpen(true)}>
            {t("common.delete")}
          </Button>
        </div>
      )}

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
    </div>
  );
};
