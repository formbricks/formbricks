"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { AccessTable } from "@/modules/ee/teams/project-teams/components/access-table";
import { ManageTeam } from "@/modules/ee/teams/project-teams/components/manage-team";
import { TProjectTeam } from "@/modules/ee/teams/project-teams/types/team";
import { useTranslations } from "next-intl";

interface AccessViewProps {
  teams: TProjectTeam[];
  environmentId: string;
  isOwnerOrManager: boolean;
}

export const AccessView = ({ teams, environmentId, isOwnerOrManager }: AccessViewProps) => {
  const t = useTranslations();
  return (
    <>
      <SettingsCard
        title={t("common.team_access")}
        description={t("environments.project.teams.team_settings_description")}>
        <div className="mb-4 flex justify-end">
          <ManageTeam environmentId={environmentId} isOwnerOrManager={isOwnerOrManager} />
        </div>
        <AccessTable teams={teams} />
      </SettingsCard>
    </>
  );
};
