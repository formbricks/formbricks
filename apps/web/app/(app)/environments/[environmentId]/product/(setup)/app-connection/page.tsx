import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { EnvironmentIdField } from "@/app/(app)/environments/[environmentId]/product/(setup)/components/EnvironmentIdField";
import { SetupInstructions } from "@/app/(app)/environments/[environmentId]/product/(setup)/components/SetupInstructions";
import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import {
  getMultiLanguagePermission,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { EnvironmentNotice } from "@/modules/ui/components/environment-notice";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslations } from "next-intl/server";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { SettingsCard } from "../../../settings/components/SettingsCard";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const [environment, organization] = await Promise.all([
    getEnvironment(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="app-connection"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <div className="space-y-4">
        <EnvironmentNotice environmentId={params.environmentId} subPageUrl="/product/app-connection" />
        <SettingsCard
          title={t("environments.product.app-connection.app_connection")}
          description={t("environments.product.app-connection.app_connection_description")}>
          {environment && <WidgetStatusIndicator environment={environment} />}
        </SettingsCard>
        <SettingsCard
          title={t("environments.product.app-connection.how_to_setup")}
          description={t("environments.product.app-connection.how_to_setup_description")}
          noPadding>
          <SetupInstructions environmentId={params.environmentId} webAppUrl={WEBAPP_URL} />
        </SettingsCard>
        <SettingsCard
          title={t("environments.product.app-connection.environment_id")}
          description={t("environments.product.app-connection.environment_id_description")}>
          <EnvironmentIdField environmentId={params.environmentId} />
        </SettingsCard>
      </div>
    </PageContentWrapper>
  );
};

export default Page;
