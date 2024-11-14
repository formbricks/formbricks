"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { DeleteAccountModal } from "@/modules/account/components/DeleteAccountModal";
import { useTranslations } from "next-intl";
import React, { useState } from "react";
import { TUser } from "@formbricks/types/user";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/components/Alert";
import { Button } from "@formbricks/ui/components/Button";

interface RemovedFromOrganizationProps {
  isFormbricksCloud: boolean;
  user: TUser;
}

export const RemovedFromOrganization = ({ user, isFormbricksCloud }: RemovedFromOrganizationProps) => {
  const t = useTranslations();
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
      />
      <Button onClick={() => setIsModalOpen(true)}>{t("setup.organization.create.delete_account")}</Button>
    </div>
  );
};
