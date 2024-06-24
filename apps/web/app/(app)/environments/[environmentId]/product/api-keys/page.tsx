import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { getServerSession } from "next-auth";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { EnvironmentNotice } from "@formbricks/ui/EnvironmentNotice";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { SettingsCard } from "../../settings/components/SettingsCard";
import { ApiKeyList } from "./components/ApiKeyList";

const Page = async ({ params }) => {
  const [session, environment, product, organization] = await Promise.all([
    getServerSession(authOptions),
    getEnvironment(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }
  if (!organization) {
    throw new Error("Organization not found");
  }
  if (!session) {
    throw new Error("Unauthenticated");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const currentProductChannel = product?.config.channel ?? null;

  return !isViewer ? (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="api-keys"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          productChannel={currentProductChannel}
        />
      </PageHeader>
      <EnvironmentNotice environmentId={environment.id} subPageUrl="/product/api-keys" />
      {environment.type === "development" ? (
        <SettingsCard
          title="Development Env Keys"
          description="Add and remove API keys for your Development environment.">
          <ApiKeyList environmentId={params.environmentId} environmentType="development" />
        </SettingsCard>
      ) : (
        <SettingsCard
          title="Production Env Keys"
          description="Add and remove API keys for your Production environment.">
          <ApiKeyList environmentId={params.environmentId} environmentType="production" />
        </SettingsCard>
      )}
    </PageContentWrapper>
  ) : (
    <ErrorComponent />
  );
};

export default Page;
