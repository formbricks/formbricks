"use client";

import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";

interface CreateTeamButtonProps {
  organizationId: string;
}

export const CreateTeamButton = ({ organizationId }: CreateTeamButtonProps) => {
  const t = useTranslations();
  const [openCreateTeamModal, setOpenCreateTeamModal] = useState<boolean>(false);
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpenCreateTeamModal(true)}>
        {t("environments.settings.teams.create_team")}
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
