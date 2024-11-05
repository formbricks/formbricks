"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";
import { CreateOrganizationModal } from "@formbricks/ui/components/CreateOrganizationModal";

export const CreateOrganization = () => {
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState<boolean>(false);
  const t = useTranslations();

  return (
    <>
      <Button variant="primary" onClick={() => setOpenCreateOrganizationModal(true)}>
        {t("organizations.landing.create_organization")}
      </Button>
      <CreateOrganizationModal open={openCreateOrganizationModal} setOpen={setOpenCreateOrganizationModal} />
    </>
  );
};
