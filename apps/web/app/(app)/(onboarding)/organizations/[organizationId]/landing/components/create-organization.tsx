"use client";

import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";
import { CreateOrganizationModal } from "@formbricks/ui/components/CreateOrganizationModal";

export const CreateOrganization = () => {
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState<boolean>(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpenCreateOrganizationModal(true)}>
        Create organization
      </Button>
      <CreateOrganizationModal open={openCreateOrganizationModal} setOpen={setOpenCreateOrganizationModal} />
    </>
  );
};
