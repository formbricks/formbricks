"use client";

import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";

interface CreateTeamButtonProps {
  organizationId: string;
}

export const CreateTeamButton = ({ organizationId }: CreateTeamButtonProps) => {
  const [openCreateTeamModal, setOpenCreateTeamModal] = useState<boolean>(false);
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpenCreateTeamModal(true)}>
        Create Team
      </Button>
      {openCreateTeamModal && (
        <CreateTeamModal
          open={openCreateTeamModal}
          setOpen={setOpenCreateTeamModal}
          organizationId={organizationId}
        />
      )}
    </>
  );
};
