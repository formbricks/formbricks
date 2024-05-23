import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { notFound } from "next/navigation";

import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { EditLanguage } from "@formbricks/ee/multiLanguage/components/EditLanguage";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeam } from "@formbricks/lib/team/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const product = await getProductByEnvironmentId(params.environmentId);

  if (!product) {
    throw new Error("Product not found");
  }

  const team = await getTeam(product?.teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(team);

  if (!isMultiLanguageAllowed) {
    notFound();
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="languages"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
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
