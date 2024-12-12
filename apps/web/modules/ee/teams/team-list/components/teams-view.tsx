import { TeamsTable } from "@/modules/ee/teams/team-list/components/teams-table";
import { getMembersByOrganizationId } from "@/modules/ee/teams/team-list/lib/membership";
import { getProjectsByOrganizationId } from "@/modules/ee/teams/team-list/lib/project";
import { getTeams } from "@/modules/ee/teams/team-list/lib/team";
import { getTranslations } from "next-intl/server";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamsViewProps {
  organizationId: string;
  membershipRole?: TOrganizationRole;
  currentUserId: string;
}

export const TeamsView = async ({ organizationId, membershipRole, currentUserId }: TeamsViewProps) => {
  const t = await getTranslations();

  const teams = await getTeams(currentUserId, organizationId);

  if (!teams) {
    throw new Error(t("common.teams_not_found"));
  }
  const orgMembers = await getMembersByOrganizationId(organizationId);

  const orgProjects = await getProjectsByOrganizationId(organizationId);

  return (
    <TeamsTable
      teams={teams}
      membershipRole={membershipRole}
      organizationId={organizationId}
      orgMembers={orgMembers}
      orgProjects={orgProjects}
      currentUserId={currentUserId}
    />
  );
};
