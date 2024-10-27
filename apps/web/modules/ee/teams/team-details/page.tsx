import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { DetailsView } from "@/modules/ee/teams/team-details/components/details-view";
import { TeamsNavigationBreadcrumbs } from "@/modules/ee/teams/team-details/components/team-navigation";
import { getTeam } from "@/modules/ee/teams/team-details/lib/teams";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

export const TeamDetails = async ({ params }) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthenticated");
  }
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const team = await getTeam(params.teamId);
  if (!team) {
    throw new Error("Team not found");
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const userId = session.user.id;

  return (
    <PageContentWrapper>
      <div className="">
        <PageHeader pageTitle="Organization Settings">
          <OrganizationSettingsNavbar
            environmentId={params.environmentId}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            membershipRole={currentUserMembership?.organizationRole}
            activeId="teams"
          />
        </PageHeader>
        <TeamsNavigationBreadcrumbs teamName={team.name} />
      </div>
      <DetailsView team={team} userId={userId} membershipRole={currentUserMembership?.organizationRole} />
    </PageContentWrapper>
  );
};
