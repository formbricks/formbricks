"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { DeleteAccountModal } from "@/modules/account/components/DeleteAccountModal";
import { Button } from "@/modules/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface DeleteAccountCardProps {
  user: TUser;
  isFormbricksCloud: boolean;
  organizationsWithSingleOwner: TOrganization[];
  isMultiOrgEnabled: boolean;
  requiresPasswordConfirmation: boolean;
}

export const DeleteAccountCard = ({
  user,
  isFormbricksCloud,
  organizationsWithSingleOwner,
  isMultiOrgEnabled,
  requiresPasswordConfirmation,
}: Readonly<DeleteAccountCardProps>) => {
  const { t } = useTranslation();
  const [isModalOpen, setModalOpen] = useState(false);
  // On a single-organization instance the last owner cannot leave their organization behind.
  const isDeleteDisabled = !isMultiOrgEnabled && organizationsWithSingleOwner.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("shell.account.delete.title")}</CardTitle>
        <CardDescription>{t("shell.account.delete.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipRenderer
          shouldRender={isDeleteDisabled}
          tooltipContent={t("workspace.settings.profile.warning_cannot_delete_account")}>
          <Button variant="destructive" onClick={() => setModalOpen(true)} disabled={isDeleteDisabled}>
            {t("shell.account.delete.action")}
          </Button>
        </TooltipRenderer>
      </CardContent>
      <DeleteAccountModal
        requiresPasswordConfirmation={requiresPasswordConfirmation}
        open={isModalOpen}
        setOpen={setModalOpen}
        user={user}
        isFormbricksCloud={isFormbricksCloud}
        organizationsWithSingleOwner={organizationsWithSingleOwner}
      />
    </Card>
  );
};
