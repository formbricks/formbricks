"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { DeleteAccountModal } from "@/modules/account/components/DeleteAccountModal";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { TUser } from "@formbricks/types/user";

interface RemovedFromOrganizationProps {
  isFormbricksCloud: boolean;
  user: TUser;
}

export const RemovedFromOrganization = ({ user, isFormbricksCloud }: RemovedFromOrganizationProps) => {
  const { t } = useTranslate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTitle>{t("setup.organization.create.no_membership_found")}</AlertTitle>
        <AlertDescription>{t("setup.organization.create.no_membership_found_description")}</AlertDescription>
      </Alert>
      <hr className="my-4 border-slate-200" />
      <p className="text-sm">{t("setup.organization.create.delete_account_description")}</p>
      <DeleteAccountModal
        open={isModalOpen}
        setOpen={setIsModalOpen}
        user={user}
        isFormbricksCloud={isFormbricksCloud}
        formbricksLogout={formbricksLogout}
        organizationsWithSingleOwner={[]}
      />
      <Button
        onClick={() => {
          setIsModalOpen(true);
        }}>
        {t("setup.organization.create.delete_account")}
      </Button>
    </div>
  );
};
