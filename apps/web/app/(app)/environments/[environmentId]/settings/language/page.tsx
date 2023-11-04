export const revalidate = REVALIDATION_INTERVAL;
import EditLanguage from "@/app/(app)/environments/[environmentId]/settings/language/EditLanguage";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import SettingsTitle from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";
export default async function LanguageSettingsPage({ params }: { params: { environmentId: string } }) {
  return (
    <div>
      <SettingsTitle title="Languages" />
      <SettingsCard
        title="Languages"
        description="Add languages to activate field level transaltions in your product.">
        <EditLanguage />
      </SettingsCard>
    </div>
  );
}
