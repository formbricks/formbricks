"use client";

import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { AccessTable } from "@/modules/ee/teams/project-teams/components/access-table";
import { ManageTeam } from "@/modules/ee/teams/project-teams/components/manage-team";
import { TProjectTeam } from "@/modules/ee/teams/project-teams/types/team";

interface AccessViewProps {
  teams: TProjectTeam[];
  environmentId: string;
}

export const AccessView = ({ teams, environmentId }: AccessViewProps) => {
  const { t } = useTranslation();
  return (
    <>
      <SettingsCard
        title={t("common.team_access")}
        description={t("environments.project.teams.team_settings_description")}>
        <div className="mb-4 flex justify-end">
          <ManageTeam environmentId={environmentId} />
        </div>
        <AccessTable teams={teams} />
      </SettingsCard>
    </>
  );
};
