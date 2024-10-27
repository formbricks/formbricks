"use client";

import { addAccessAction } from "@/modules/ee/teams/team-access/actions";
import { AddTeamModal } from "@/modules/ee/teams/team-access/components/add-team-modal";
import { TOrganizationTeam, TProductTeam } from "@/modules/ee/teams/team-access/types/teams";
import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";

interface AddTeamProps {
  organizationTeams: TOrganizationTeam[];
  productTeams: TProductTeam[];
  productId: string;
  organizationId: string;
}

export const AddTeam = ({ organizationTeams, productTeams, productId, organizationId }: AddTeamProps) => {
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState<boolean>(false);
  const [addTeamModalOpen, setAddTeamModalOpen] = useState<boolean>(false);

  const teams = organizationTeams
    .filter((team) => !productTeams.find((productTeam) => productTeam.id === team.id))
    .map((team) => ({ label: team.name, value: team.id }));

  const onCreate = async (teamId: string) => {
    await addAccessAction({ productId, teamIds: [teamId] });
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setCreateTeamModalOpen(true)}>
        Create Team
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setAddTeamModalOpen(true)}>
        Add Team
      </Button>
      {addTeamModalOpen && (
        <AddTeamModal
          open={addTeamModalOpen}
          setOpen={setAddTeamModalOpen}
          teamOptions={teams}
          productId={productId}
        />
      )}

      {createTeamModalOpen && (
        <CreateTeamModal
          open={createTeamModalOpen}
          setOpen={setCreateTeamModalOpen}
          organizationId={organizationId}
          onCreate={onCreate}
        />
      )}
    </>
  );
};
