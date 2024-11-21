import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import { DetailsView } from "@/modules/ee/teams/team-details/components/details-view";
import { TeamsNavigationBreadcrumbs } from "@/modules/ee/teams/team-details/components/team-navigation";
import {
  getMembersByOrganizationId,
  getProjectsByOrganizationId,
  getTeam,
  getTeamProjects,
} from "@/modules/ee/teams/team-details/lib/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";

export const TeamDetails = async (props) => {
  const params = await props.params;

  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("common.session_not_found");
  }
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const team = await getTeam(params.teamId);
  if (!team) {
    throw new Error(t("common.team_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling, isMember } = getAccessFlags(currentUserMembership?.role);

  const teamRole = await getTeamRoleByTeamIdUserId(params.teamId, session.user.id);

  const canDoRoleManagement = await getRoleManagementPermission(organization);

  if (!canDoRoleManagement || isBilling || (isMember && !teamRole)) {
    notFound();
  }

  const userId = session.user.id;

  const organizationMembers = await getMembersByOrganizationId(organization.id);

  const teamProjects = await getTeamProjects(params.teamId);

  const organizationProjects = await getProjectsByOrganizationId(organization.id);

  return (
    <PageContentWrapper>
      <TeamsNavigationBreadcrumbs teamName={team.name} />
      <DetailsView
        team={team}
        organizationMembers={organizationMembers}
        userId={userId}
        membershipRole={currentUserMembership?.role}
        teamRole={teamRole}
        projects={teamProjects}
        organizationProjects={organizationProjects}
      />
    </PageContentWrapper>
  );
};
