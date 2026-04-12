import { IS_FORMBRICKS_CLOUD, USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getTeamsWhereUserIsAdmin } from "@/modules/ee/teams/lib/roles";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  const isAccessControlAllowed = await getAccessControlPermission(organization.id);

  const hasStandardUserManagementAccess = getUserManagementAccess(
    currentUserMembership?.role,
    USER_MANAGEMENT_MINIMUM_ROLE
  );

  const userAdminTeamIds = await getTeamsWhereUserIsAdmin(session.user.id, organization.id);
  const isTeamAdminUser = userAdminTeamIds.length > 0;

  const hasUserManagementAccess =
    hasStandardUserManagementAccess || (isAccessControlAllowed && isTeamAdminUser);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")} />
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

export default Page;
