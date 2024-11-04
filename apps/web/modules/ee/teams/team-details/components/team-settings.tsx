"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { DeleteTeam } from "@/modules/ee/teams/team-details/components/delete-team";
import { EditTeamNameForm } from "@/modules/ee/teams/team-details/components/edit-team-name-form";
import { TTeam } from "@/modules/ee/teams/team-details/types/teams";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamSettingsProps {
  team: TTeam;
  membershipRole?: TOrganizationRole;
}

export const TeamSettings = ({ team, membershipRole }: TeamSettingsProps) => {
  return (
    <div>
      <SettingsCard title="Team Name" description="Give your team a descriptive name.">
        <EditTeamNameForm team={team} membershipRole={membershipRole} />
      </SettingsCard>
      <SettingsCard title="Delete team" description="">
        <DeleteTeam teamId={team.id} membershipRole={membershipRole} />
      </SettingsCard>
    </div>
  );
};
