import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD, USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const TeamsPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  const isAccessControlAllowed = await getAccessControlPermission(organization.billing.plan);
  const hasUserManagementAccess = getUserManagementAccess(
    currentUserMembership?.role,
    USER_MANAGEMENT_MINIMUM_ROLE
  );

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
        isAccessControlAllowed={isAccessControlAllowed}
        isUserManagementDisabledFromUi={!hasUserManagementAccess}
      />
      <TeamsView
        organizationId={organization.id}
        membershipRole={currentUserMembership?.role}
        currentUserId={session.user.id}
        isAccessControlAllowed={isAccessControlAllowed}
        environmentId={params.environmentId}
      />
    </PageContentWrapper>
  );
};
