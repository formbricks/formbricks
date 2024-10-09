import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { EnvironmentIdField } from "@/app/(app)/environments/[environmentId]/product/(setup)/components/EnvironmentIdField";
import { SetupInstructions } from "@/app/(app)/environments/[environmentId]/product/(setup)/components/SetupInstructions";
import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { EnvironmentNotice } from "@formbricks/ui/components/EnvironmentNotice";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { SettingsCard } from "../../../settings/components/SettingsCard";

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
          activeId="app-connection"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
        />
      </PageHeader>
      <div className="space-y-4">
        <EnvironmentNotice environmentId={params.environmentId} subPageUrl="/product/app-connection" />
        <SettingsCard
          title="Website & App Connection Status"
          description="Check if your app is successfully connected with Formbricks. Reload page to recheck.">
          {environment && <WidgetStatusIndicator environment={environment} />}
        </SettingsCard>
        <SettingsCard
          title="Your EnvironmentId"
          description="This id uniquely identifies this Formbricks environment.">
          <EnvironmentIdField environmentId={params.environmentId} />
        </SettingsCard>
        <SettingsCard
          title="How To Setup"
          description="Follow these steps to setup the Formbricks widget within your app"
          noPadding>
          <SetupInstructions environmentId={params.environmentId} webAppUrl={WEBAPP_URL} />
        </SettingsCard>
      </div>
    </PageContentWrapper>
  );
};

export default Page;
