import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { notFound } from "next/navigation";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { EditLanguage } from "@formbricks/ee/multi-language/components/edit-language";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

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

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="common.configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="languages"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
        />
      </PageHeader>
      <SettingsCard
        title="environments.product.languages.multi_language_surveys"
        description="environments.product.languages.multi_language_surveys_description">
        <EditLanguage product={product} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
