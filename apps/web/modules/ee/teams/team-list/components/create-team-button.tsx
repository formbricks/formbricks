"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { Button } from "@/modules/ui/components/button";

interface CreateTeamButtonProps {
  organizationId: string;
}

export const CreateTeamButton = ({ organizationId }: CreateTeamButtonProps) => {
  const { t } = useTranslation();
  const [openCreateTeamModal, setOpenCreateTeamModal] = useState<boolean>(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpenCreateTeamModal(true)}>
        {t("environments.settings.teams.create_new_team")}
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
