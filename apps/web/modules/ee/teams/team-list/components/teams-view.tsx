import { TeamsTable } from "@/modules/ee/teams/team-list/components/teams-table";
import { TOtherTeam, TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamsViewProps {
  organizationId: string;
  teams: { userTeams: TUserTeam[]; otherTeams: TOtherTeam[] };
  membershipRole?: TOrganizationRole;
  currentUserId: string;
}

export const TeamsView = ({ organizationId, teams, membershipRole, currentUserId }: TeamsViewProps) => {
  const { isOwner, isManager } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isOwner || isManager;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-6">
        <TeamsTable
          teams={teams}
          currentUserId={currentUserId}
          isOwnerOrManager={isOwnerOrManager}
          organizationId={organizationId}
        />
      </div>
    </div>
  );
};
