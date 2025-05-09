"use client";

import { DeleteAccountModal } from "@/modules/account/components/DeleteAccountModal";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import type { Session } from "next-auth";
import { useState } from "react";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

export const DeleteAccount = ({
  session,
  IS_FORMBRICKS_CLOUD,
  user,
  organizationsWithSingleOwner,
  isMultiOrgEnabled,
}: {
  session: Session | null;
  IS_FORMBRICKS_CLOUD: boolean;
  user: TUser;
  organizationsWithSingleOwner: TOrganization[];
  isMultiOrgEnabled: boolean;
}) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const isDeleteDisabled = !isMultiOrgEnabled && organizationsWithSingleOwner.length > 0;
  const { t } = useTranslate();
  if (!session) {
    return null;
  }

  return (
    <div>
      <DeleteAccountModal
        open={isModalOpen}
        setOpen={setModalOpen}
        user={user}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        organizationsWithSingleOwner={organizationsWithSingleOwner}
      />
      <p className="text-sm text-slate-700">
        <strong>{t("environments.settings.profile.warning_cannot_undo")}</strong>
      </p>
      <TooltipRenderer
        shouldRender={isDeleteDisabled}
        tooltipContent={t("environments.settings.profile.warning_cannot_delete_account")}>
        <Button
          className="mt-4"
          variant="destructive"
          size="sm"
          onClick={() => setModalOpen(!isModalOpen)}
          disabled={isDeleteDisabled}>
          {t("environments.settings.profile.confirm_delete_my_account")}
        </Button>
      </TooltipRenderer>
    </div>
  );
};
