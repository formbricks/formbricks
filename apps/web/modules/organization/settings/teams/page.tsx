import { canManageUsers } from "@/lib/membership/user-management";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getTeamsWhereUserIsAdmin } from "@/modules/ee/teams/lib/roles";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const TeamsPage = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const params = await props.params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { session, currentUserMembership, organization } = await getOrganizationAuth(params.organizationId);

  // Independent lookups, so they run together. `canManageUsers` is owners and managers above the
  // user-management floor: the same question the member and invite actions ask, so a control is
  // offered exactly where its action accepts it (ENG-6812). Team admins get limited user management
  // for invites into their own teams.
  const [isAccessControlAllowed, hasStandardUserManagementAccess, userAdminTeamIds] = await Promise.all([
    getAccessControlPermission(organization.id),
    canManageUsers(session.user.id, organization.id),
    getTeamsWhereUserIsAdmin(session.user.id, organization.id),
  ]);
  const isTeamAdminUser = userAdminTeamIds.length > 0;

  // Allow user management UI if they're owner/manager OR team admin (when access control is enabled)
  const hasUserManagementAccess =
    hasStandardUserManagementAccess || (isAccessControlAllowed && isTeamAdminUser);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.teams")} />
      <MembersView
        membershipRole={currentUserMembership?.role}
        organization={organization}
        currentUserId={session.user.id}
        isAccessControlAllowed={isAccessControlAllowed}
        isUserManagementDisabledFromUi={!hasUserManagementAccess}
        canManageUsers={hasStandardUserManagementAccess}
      />
      <TeamsView
        organizationId={organization.id}
        membershipRole={currentUserMembership?.role}
        currentUserId={session.user.id}
        isAccessControlAllowed={isAccessControlAllowed}
      />
    </PageContentWrapper>
  );
};
