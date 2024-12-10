import { TeamsTable } from "@/modules/ee/teams/team-list/components/teams-table";
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
  const { isOwner, isManager } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isOwner || isManager;

  return <TeamsTable teams={teams} isOwnerOrManager={isOwnerOrManager} organizationId={organizationId} />;
};
