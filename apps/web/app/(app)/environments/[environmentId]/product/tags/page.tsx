import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getServerSession } from "next-auth";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getTagsOnResponsesCount } from "@formbricks/lib/tagOnResponse/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { EditTagsWrapper } from "./components/EditTagsWrapper";

const Page = async ({ params }) => {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const [tags, environmentTagsCount, product, organization, session] = await Promise.all([
    getTagsByEnvironmentId(params.environmentId),
    getTagsOnResponsesCount(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
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
  const isTagSettingDisabled = isViewer;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const currentProductChannel = product?.config.channel ?? null;

  return !isTagSettingDisabled ? (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="tags"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          productChannel={currentProductChannel}
        />
      </PageHeader>
      <SettingsCard title="Manage Tags" description="Add, merge and remove response tags.">
        <EditTagsWrapper
          environment={environment}
          environmentTags={tags}
          environmentTagsCount={environmentTagsCount}
        />
      </SettingsCard>
    </PageContentWrapper>
  ) : (
    <ErrorComponent />
  );
};

export default Page;
