export const revalidate = REVALIDATION_INTERVAL;
import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import SettingsTitle from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";
import EditLanguage from "@formbricks/ee/multiLanguage/components/EditLanguage";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
export default async function LanguageSettingsPage({ params }: { params: { environmentId: string } }) {
  const product = await getProductByEnvironmentId(params.environmentId);

  if (!product) {
    throw new Error("Product not found");
  }
  return (
    <div>
      <SettingsTitle title="Languages" />
      <SettingsCard
        title="Multi-language surveys"
        description="Add languages to create multi-language surveys.">
        <EditLanguage product={product} />
      </SettingsCard>
    </div>
  );
}
