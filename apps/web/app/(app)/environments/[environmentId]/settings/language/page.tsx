import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import SettingsTitle from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";
import { notFound } from "next/navigation";

import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import EditLanguage from "@formbricks/ee/multiLanguage/components/EditLanguage";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeam } from "@formbricks/lib/team/service";

export default async function LanguageSettingsPage({ params }: { params: { environmentId: string } }) {
  const product = await getProductByEnvironmentId(params.environmentId);

  if (!product) {
    throw new Error("Product not found");
  }

  const team = await getTeam(product?.teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isMultiLanguageAllowed = getMultiLanguagePermission(team);

  if (!isMultiLanguageAllowed) {
    notFound();
  }

  return (
    <div>
      <SettingsTitle title="Survey Languages" />
      <SettingsCard
        title="Multi-language surveys"
        description="Add languages to create multi-language surveys.">
        <EditLanguage product={product} environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
