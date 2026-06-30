"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { Alert, AlertButton, AlertDescription } from "@/modules/ui/components/alert";

export const CreateOrganizationCard = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-4xl">
      <Alert variant="info" size="small">
        <AlertDescription>
          {t("workspace.settings.general.create_new_organization_description")}
        </AlertDescription>
        <AlertButton onClick={() => setOpen(true)}>
          {t("workspace.settings.general.create_new_organization")}
        </AlertButton>
      </Alert>
      {open && <CreateOrganizationModal open={open} setOpen={setOpen} />}
    </div>
  );
};
