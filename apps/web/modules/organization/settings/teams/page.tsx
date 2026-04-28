import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getUserManagementAccess } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getTeamsWhereUserIsAdmin } from "@/modules/ee/teams/lib/roles";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const TeamsPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization } = await getWorkspaceAuth(params.workspaceId);

  const isAccessControlAllowed = await getAccessControlPermission(organization.id);

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

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.members_and_teams")} />
      <MembersView
        membershipRole={currentUserMembership?.role}
        organization={organization}
        currentUserId={session.user.id}
        isAccessControlAllowed={isAccessControlAllowed}
        isUserManagementDisabledFromUi={!hasUserManagementAccess}
      />
      <TeamsView
        organizationId={organization.id}
        membershipRole={currentUserMembership?.role}
        currentUserId={session.user.id}
        isAccessControlAllowed={isAccessControlAllowed}
        workspaceId={params.workspaceId}
      />
    </PageContentWrapper>
  );
};
