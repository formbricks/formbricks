"use client";

import { AddTeamModal } from "@/modules/ee/teams/team-access/components/add-team-modal";
import { TOrganizationTeam, TProductTeam } from "@/modules/ee/teams/team-access/types/teams";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";

interface AddTeamProps {
  organizationTeams: TOrganizationTeam[];
  productTeams: TProductTeam[];
  productId: string;
}

export const AddTeam = ({ organizationTeams, productTeams, productId }: AddTeamProps) => {
  const [addTeamModalOpen, setAddTeamModalOpen] = useState<boolean>(false);

  const teams = organizationTeams
    .filter((team) => !productTeams.find((productTeam) => productTeam.id === team.id))
    .map((team) => ({ label: team.name, value: team.id }));

  return (
    <>
      <Button variant="primary" size="sm" className="ml-auto" onClick={() => setAddTeamModalOpen(true)}>
        Add Team
      </Button>
      <AddTeamModal
        open={addTeamModalOpen}
        setOpen={setAddTeamModalOpen}
        teamOptions={teams}
        productId={productId}
      />
    </>
  );
};
