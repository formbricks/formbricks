export const revalidate = REVALIDATION_INTERVAL;
import EditLanguage from "@formbricks/ee/multiLanguage/components/EditLanguage";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import SettingsTitle from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";
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
        title="Languages"
        description="Add languages to activate field level transaltions in your product.">
        <EditLanguage product={product} />
      </SettingsCard>
    </div>
  );
}
