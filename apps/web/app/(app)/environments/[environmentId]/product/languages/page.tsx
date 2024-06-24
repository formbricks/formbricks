import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { notFound } from "next/navigation";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { EditLanguage } from "@formbricks/ee/multi-language/components/edit-language";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const product = await getProductByEnvironmentId(params.environmentId);

  if (!product) {
    throw new Error("Product not found");
  }

  const organization = await getOrganization(product?.organizationId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

  if (!isMultiLanguageAllowed) {
    notFound();
  }
  const currentProductChannel = product?.config.channel ?? null;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="languages"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          productChannel={currentProductChannel}
        />
      </PageHeader>
      <SettingsCard
        title="Multi-language surveys"
        description="Add languages to create multi-language surveys.">
        <EditLanguage product={product} environmentId={params.environmentId} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
