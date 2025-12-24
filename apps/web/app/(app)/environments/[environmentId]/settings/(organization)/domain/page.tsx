import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getSurveysWithSlugsByOrganizationId } from "@/modules/survey/lib/slug";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsCard } from "../../components/SettingsCard";
import { OrganizationSettingsNavbar } from "../components/OrganizationSettingsNavbar";
import { PrettyUrlsTable } from "./components/pretty-urls-table";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  if (IS_FORMBRICKS_CLOUD) {
    return notFound();
  }

  const { session, currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const result = await getSurveysWithSlugsByOrganizationId(organization.id);
  if (!result.ok) {
    throw new Error(t("common.something_went_wrong"));
  }

  const surveys = result.data;

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
        <PrettyUrlsTable surveys={surveys} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
