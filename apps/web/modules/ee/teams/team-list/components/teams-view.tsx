import { CreateTeamButton } from "@/modules/ee/teams/team-list/components/create-team-button";
import { OtherTeams } from "@/modules/ee/teams/team-list/components/other-teams";
import { YourTeams } from "@/modules/ee/teams/team-list/components/your-teams";
import { TOtherTeam, TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { H3 } from "@formbricks/ui/components/Typography";

interface TeamsViewProps {
  organizationId: string;
  teams: { userTeams: TUserTeam[]; otherTeams?: TOtherTeam[] };
  membershipRole?: TOrganizationRole;
}

export const TeamsView = ({ organizationId, teams, membershipRole }: TeamsViewProps) => {
  const { isOwner, isManager } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isOwner || isManager;

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <H3>Teams</H3>
        {isOwnerOrManager && <CreateTeamButton organizationId={organizationId} />}
      </div>
      <div className="flex flex-col gap-6">
        <YourTeams teams={teams.userTeams} />
        {teams.otherTeams && <OtherTeams teams={teams.otherTeams} />}
      </div>
    </div>
  );
};
