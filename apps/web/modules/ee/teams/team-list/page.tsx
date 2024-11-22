import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { getTeams } from "@/modules/ee/teams/team-list/lib/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

export const TeamsPage = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const canDoRoleManagement = await getRoleManagementPermission(organization);
  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (!canDoRoleManagement || isBilling) {
    notFound();
  }

  const teams = await getTeams(session.user.id, organization.id);

  if (!teams) {
    throw new Error(t("common.teams_not_found"));
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="teams"
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <TeamsView
        teams={teams}
        organizationId={organization.id}
        membershipRole={currentUserMembership?.role}
        currentUserId={session.user.id}
      />
    </PageContentWrapper>
  );
};
