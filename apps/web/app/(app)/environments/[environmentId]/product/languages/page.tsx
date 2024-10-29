import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { notFound } from "next/navigation";
import { getMultiLanguagePermission, getRoleManagementPermission } from "@formbricks/ee/lib/service";
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

  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="languages"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <SettingsCard
        title="Multi-Language Surveys"
        description="Add languages to create multi-language surveys.">
        <EditLanguage product={product} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
