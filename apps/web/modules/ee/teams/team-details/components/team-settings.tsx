"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { DeleteTeam } from "@/modules/ee/teams/team-details/components/delete-team";
import { EditTeamNameForm } from "@/modules/ee/teams/team-details/components/edit-team-name-form";
import { TTeam } from "@/modules/ee/teams/team-details/types/teams";
import { useTranslations } from "next-intl";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamSettingsProps {
  team: TTeam;
  membershipRole?: TOrganizationRole;
}

export const TeamSettings = ({ team, membershipRole }: TeamSettingsProps) => {
  const t = useTranslations();
  return (
    <div>
      <SettingsCard
        title={t("environments.settings.teams.team_name")}
        description={t("environments.settings.teams.team_name_description")}>
        <EditTeamNameForm team={team} membershipRole={membershipRole} />
      </SettingsCard>
      <SettingsCard title={t("environments.settings.teams.delete_team")} description="">
        <DeleteTeam teamId={team.id} membershipRole={membershipRole} />
      </SettingsCard>
    </div>
  );
};
