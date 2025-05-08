"use client";

import { removeUserFromWhitelistAction } from "@/modules/organization/settings/whitelist/actions";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TOrganization } from "@formbricks/types/organizations";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface WhitelistActionsProps {
  organization: TOrganization;
  user: TUserWhitelistInfo;
  showDeleteButton?: boolean;
}

export const WhitelistActions = ({ organization, user, showDeleteButton }: WhitelistActionsProps) => {
  const router = useRouter();
  const { t } = useTranslate();
  const [isDeleteMemberModalOpen, setDeleteMemberModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRemoveUserFromWhitelist = async () => {
    try {
      setIsDeleting(true);

      await removeUserFromWhitelistAction({
        organizationId: organization.id,
        email: user.email,
      });
      toast.success(t("environments.settings.general.removed_user_from_whitelist_successfully"));

      setIsDeleting(false);
      router.refresh();
    } catch (err) {
      setIsDeleting(false);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

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
        deleteWhat={`${user.name ? user.name : user.email} ${t("environments.settings.general.from_the_whitelist")}`}
        onDelete={handleRemoveUserFromWhitelist}
        isDeleting={isDeleting}
      />
    </div>
  );
};
