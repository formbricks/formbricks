"use client";

import { addAccessAction } from "@/modules/ee/teams/product-teams/actions";
import { AddTeamModal } from "@/modules/ee/teams/product-teams/components/add-team-modal";
import { TOrganizationTeam, TProductTeam } from "@/modules/ee/teams/product-teams/types/teams";
import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { Button } from "@/modules/ui/components/button";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface AddTeamProps {
  organizationTeams: TOrganizationTeam[];
  productTeams: TProductTeam[];
  productId: string;
  organizationId: string;
}

export const AddTeam = ({ organizationTeams, productTeams, productId, organizationId }: AddTeamProps) => {
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState<boolean>(false);
  const [addTeamModalOpen, setAddTeamModalOpen] = useState<boolean>(false);
  const t = useTranslations();

  const teams = organizationTeams
    .filter((team) => !productTeams.find((productTeam) => productTeam.id === team.id))
    .map((team) => ({ label: team.name, value: team.id }));

  const onCreate = async (teamId: string) => {
    await addAccessAction({ productId, teamIds: [teamId] });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setCreateTeamModalOpen(true)}>
        {t("environments.product.teams.create_new_team")}
      </Button>
      <Button variant="primary" size="sm" onClick={() => setAddTeamModalOpen(true)}>
        {t("environments.product.teams.add_existing_team")}
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
