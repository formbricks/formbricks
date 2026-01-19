import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD, IS_STORAGE_CONFIGURED } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import { FaviconCustomizationSettings } from "@/modules/ee/whitelabel/favicon-customization/components/favicon-customization-settings";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getSurveysWithSlugsByOrganizationId } from "@/modules/survey/lib/slug";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
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

  const { session, currentUserMembership, organization, isOwner, isManager } = await getEnvironmentAuth(
    params.environmentId
  );

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasWhiteLabelPermission = await getWhiteLabelPermission(organization.billing.plan);
  const isOwnerOrManager = isManager || isOwner;

  const surveys = await getSurveysWithSlugsByOrganizationId(organization.id);

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

      {!IS_STORAGE_CONFIGURED && (
        <div className="max-w-4xl">
          <Alert variant="warning">
            <AlertDescription>{t("common.storage_not_configured")}</AlertDescription>
          </Alert>
        </div>
      )}

      <FaviconCustomizationSettings
        organization={organization}
        hasWhiteLabelPermission={hasWhiteLabelPermission}
        environmentId={params.environmentId}
        isReadOnly={!isOwnerOrManager}
        isStorageConfigured={IS_STORAGE_CONFIGURED}
      />

      <SettingsCard
        title={t("environments.settings.domain.title")}
        description={t("environments.settings.domain.description")}>
        <PrettyUrlsTable surveys={surveys} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
