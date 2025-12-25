import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD, USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getTeamsWhereUserIsAdmin } from "@/modules/ee/teams/lib/roles";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { SecurityUpdatesCard } from "@/modules/organization/settings/teams/components/security-updates-card";
import { getSecurityUpdatesStatus } from "@/modules/organization/settings/teams/lib/security-updates";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const TeamsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization, isOwner } = await getEnvironmentAuth(
    params.environmentId
  );

  const isAccessControlAllowed = await getAccessControlPermission(organization.billing.plan);

  // Check if user has standard user management access (owner/manager)
  const hasStandardUserManagementAccess = getUserManagementAccess(
    currentUserMembership?.role,
    USER_MANAGEMENT_MINIMUM_ROLE
  );

  // Also check if user is a team admin (they get limited user management for invites)
  const userAdminTeamIds = await getTeamsWhereUserIsAdmin(session.user.id, organization.id);
  const isTeamAdminUser = userAdminTeamIds.length > 0;

  // Allow user management UI if they're owner/manager OR team admin (when access control is enabled)
  const hasUserManagementAccess =
    hasStandardUserManagementAccess || (isAccessControlAllowed && isTeamAdminUser);

  // Fetch security updates status for self-hosted instances only (owners only)
  const shouldShowSecurityUpdates = !IS_FORMBRICKS_CLOUD && isOwner;
  const [securityUpdatesStatus, user] = shouldShowSecurityUpdates
    ? await Promise.all([getSecurityUpdatesStatus(), getUser(session.user.id)])
    : [null, null];

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

      {securityUpdatesStatus && user && (
        <SecurityUpdatesCard
          organizationId={organization.id}
          userEmail={user.email}
          securityUpdatesStatus={securityUpdatesStatus}
        />
      )}

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
