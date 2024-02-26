import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import SettingsTitle from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";

import { getIsEnterpriseEdition } from "@formbricks/ee/lib/service";
import EditLanguage from "@formbricks/ee/multiLanguage/components/EditLanguage";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

export default async function LanguageSettingsPage({ params }: { params: { environmentId: string } }) {
  const product = await getProductByEnvironmentId(params.environmentId);
  const isEnterpriseEdition = await getIsEnterpriseEdition();

  if (!product) {
    throw new Error("Product not found");
  }

  return (
    <div>
      <SettingsTitle title="Multiple Languages" />
      <SettingsCard
        title="Multi-language surveys"
        description="Add languages to create multi-language surveys.">
        <EditLanguage
          product={product}
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          isEnterpriseEdition={isEnterpriseEdition}
        />
      </SettingsCard>
    </div>
  );
}
