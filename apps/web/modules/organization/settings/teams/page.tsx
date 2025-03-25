import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

export const TeamsPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  const canDoRoleManagement = await getRoleManagementPermission(organization.billing.plan);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="teams"
        />
      </PageHeader>
      <MembersView
        membershipRole={currentUserMembership?.role}
        organization={organization}
        currentUserId={session.user.id}
        environmentId={params.environmentId}
        canDoRoleManagement={canDoRoleManagement}
      />
      <TeamsView
        organizationId={organization.id}
        membershipRole={currentUserMembership?.role}
        currentUserId={session.user.id}
        canDoRoleManagement={canDoRoleManagement}
        environmentId={params.environmentId}
      />
    </PageContentWrapper>
  );
};
