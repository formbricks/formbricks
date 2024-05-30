import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";

import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { EnvironmentNotice } from "@formbricks/ui/EnvironmentNotice";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

import { SettingsCard } from "../../settings/components/SettingsCard";
import { EnvironmentIdField } from "./components/EnvironmentIdField";
import { SetupInstructions } from "./components/SetupInstructions";

const Page = async ({ params }) => {
  const [environment, organization] = await Promise.all([
    getEnvironment(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="setup"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
        />
      </PageHeader>
      <div className="space-y-4">
        <EnvironmentNotice environmentId={params.environmentId} subPageUrl="/product/setup" />
        <SettingsCard
          title="Widget Status"
          description="Check if the Formbricks widget is alive and kicking.">
          {environment && <WidgetStatusIndicator environment={environment} type="large" />}
        </SettingsCard>
        <SettingsCard
          title="Your EnvironmentId"
          description="This Id uniquely identifies this Formbricks environment.">
          <EnvironmentIdField environmentId={params.environmentId} />
        </SettingsCard>
        <SettingsCard
          title="How to setup"
          description="Follow these steps to setup the Formbricks widget within your app"
          noPadding>
          <SetupInstructions
            environmentId={params.environmentId}
            webAppUrl={WEBAPP_URL}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          />
        </SettingsCard>
      </div>
    </PageContentWrapper>
  );
};

export default Page;
