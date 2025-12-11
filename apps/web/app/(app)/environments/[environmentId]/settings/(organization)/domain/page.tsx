import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsCard } from "../../components/SettingsCard";
import { OrganizationSettingsNavbar } from "../components/OrganizationSettingsNavbar";
import { PrettyUrlsTable } from "./components/pretty-urls-table";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="domain"
        />
      </PageHeader>

      <SettingsCard
        title={t("environments.settings.domain.title")}
        description={t("environments.settings.domain.description")}>
        <PrettyUrlsTable organizationId={organization.id} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
