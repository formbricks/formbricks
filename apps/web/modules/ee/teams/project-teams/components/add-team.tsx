"use client";

import { addAccessAction } from "@/modules/ee/teams/project-teams/actions";
import { AddTeamModal } from "@/modules/ee/teams/project-teams/components/add-team-modal";
import { TOrganizationTeam, TProjectTeam } from "@/modules/ee/teams/project-teams/types/teams";
import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";

interface AddTeamProps {
  organizationTeams: TOrganizationTeam[];
  projectTeams: TProjectTeam[];
  projectId: string;
  organizationId: string;
}

export const AddTeam = ({ organizationTeams, projectTeams, projectId, organizationId }: AddTeamProps) => {
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState<boolean>(false);
  const [addTeamModalOpen, setAddTeamModalOpen] = useState<boolean>(false);
  const t = useTranslations();

  const teams = organizationTeams
    .filter((team) => !projectTeams.find((projectTeam) => projectTeam.id === team.id))
    .map((team) => ({ label: team.name, value: team.id }));

  const onCreate = async (teamId: string) => {
    await addAccessAction({ projectId: projectId, teamIds: [teamId] });
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setCreateTeamModalOpen(true)}>
        {t("environments.project.teams.create_new_team")}
      </Button>
      <Button variant="primary" size="sm" onClick={() => setAddTeamModalOpen(true)}>
        {t("environments.project.teams.add_existing_team")}
      </Button>
      {addTeamModalOpen && (
        <AddTeamModal
          open={addTeamModalOpen}
          setOpen={setAddTeamModalOpen}
          teamOptions={teams}
          projectId={projectId}
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
