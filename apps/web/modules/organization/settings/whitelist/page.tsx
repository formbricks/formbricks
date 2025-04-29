import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const WhitelistPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, organization, currentUserMembership } = await getEnvironmentAuth(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar environmentId={params.environmentId} activeId="whitelist" />
      </PageHeader>
      <MembersView
        membershipRole={currentUserMembership.role}
        organization={organization}
        currentUserId={session.user.id}
        environmentId={params.environmentId}
      />
    </PageContentWrapper>
  );
};
