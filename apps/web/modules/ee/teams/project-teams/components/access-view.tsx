"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { AccessTable } from "@/modules/ee/teams/project-teams/components/access-table";
import { AddTeam } from "@/modules/ee/teams/project-teams/components/add-team";
import { TOrganizationTeam, TProjectTeam } from "@/modules/ee/teams/project-teams/types/teams";
import { useTranslations } from "next-intl";
import { TProject } from "@formbricks/types/project";

interface AccessViewProps {
  project: TProject;
  teams: TProjectTeam[];
  environmentId: string;
  organizationTeams: TOrganizationTeam[];
  isOwnerOrManager: boolean;
}

export const AccessView = ({
  project,
  teams,
  organizationTeams,
  environmentId,
  isOwnerOrManager,
}: AccessViewProps) => {
  const t = useTranslations();
  return (
    <>
      <SettingsCard
        title={t("common.teams")}
        description={t("environments.project.teams.team_settings_description")}>
        <div className="flex justify-end gap-2">
          {isOwnerOrManager && (
            <AddTeam
              organizationTeams={organizationTeams}
              projectTeams={teams}
              projectId={project.id}
              organizationId={project.organizationId}
            />
          )}
        </div>
        <div className="mt-2">
          <AccessTable
            teams={teams}
            projectId={project.id}
            environmentId={environmentId}
            isOwnerOrManager={isOwnerOrManager}
          />
        </div>
      </SettingsCard>
    </>
  );
};
