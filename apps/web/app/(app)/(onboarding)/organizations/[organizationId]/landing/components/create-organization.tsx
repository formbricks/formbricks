"use client";

import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";

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
