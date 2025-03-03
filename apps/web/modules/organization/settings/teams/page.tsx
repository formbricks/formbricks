import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { TeamsView } from "@/modules/ee/teams/team-list/components/teams-view";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

export const TeamsPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const canDoRoleManagement = await getRoleManagementPermission(organization.billing.plan);
  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);

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
