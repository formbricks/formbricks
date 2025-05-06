import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { WhitelistView } from "@/modules/organization/settings/whitelist/components/whitelist-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const WhitelistPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { organization, currentUserMembership } = await getEnvironmentAuth(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar environmentId={params.environmentId} activeId="whitelist" />
      </PageHeader>
      <WhitelistView
        membershipRole={currentUserMembership.role}
        organization={organization}
        environmentId={params.environmentId}
      />
    </PageContentWrapper>
  );
};
