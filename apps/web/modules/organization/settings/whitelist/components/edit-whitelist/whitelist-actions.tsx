"use client";

import { deleteMembershipAction } from "@/modules/organization/settings/teams/actions";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TMember } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface WhitelistActionsProps {
  organization: TOrganization;
  member?: TMember;
  invite?: TInvite;
  showDeleteButton?: boolean;
}

export const WhitelistActions = ({
  organization,
  member,
  invite,
  showDeleteButton,
}: WhitelistActionsProps) => {
  const router = useRouter();
  const { t } = useTranslate();
  const [isDeleteMemberModalOpen, setDeleteMemberModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRemoveWhitelistedUser = async () => {
    // TODO: Implement and call action to remove whitelisted user
    try {
      setIsDeleting(true);

      if (member && !invite) {
        // This is a member

        await deleteMembershipAction({ userId: member.userId, organizationId: organization.id });
        toast.success(t("environments.settings.general.member_deleted_successfully"));
      }

      setIsDeleting(false);
      router.refresh();
    } catch (err) {
      setIsDeleting(false);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  const memberName = useMemo(() => {
    if (member) {
      return member.name;
    }

    return "";
  }, [member]);

  return (
    <div className="flex gap-2">
      {showDeleteButton && (
        <>
          <TooltipRenderer tooltipContent={t("common.delete")}>
            <Button
              variant="secondary"
              size="icon"
              id="deleteMemberButton"
              onClick={() => setDeleteMemberModalOpen(true)}>
              <TrashIcon />
            </Button>
          </TooltipRenderer>
        </>
      )}

      <DeleteDialog
        open={isDeleteMemberModalOpen}
        setOpen={setDeleteMemberModalOpen}
        deleteWhat={`${memberName} ${t("environments.settings.general.from_your_organization")}`}
        onDelete={handleRemoveWhitelistedUser}
        isDeleting={isDeleting}
      />
    </div>
  );
};
