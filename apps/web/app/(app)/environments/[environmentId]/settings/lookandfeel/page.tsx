import { EditBrandColor } from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/EditBrandColor";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditFormbricksSignature } from "./editSignature";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { EditPlacement } from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/EditPlacement";
import { EditHighlightBorder } from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/EditHighlightBorder";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const product = await getProductByEnvironmentId(params.environmentId);
  return (
    <div>
      <SettingsTitle title="Look & Feel" />
      <SettingsCard title="Brand Color" description="Match the surveys with your user interface.">
        <EditBrandColor product={product} />
      </SettingsCard>
      <SettingsCard
        title="In-app Survey Placement"
        description="Change where surveys will be shown in your web app.">
        <EditPlacement product={product} />
      </SettingsCard>
      <SettingsCard
        noPadding
        title="Highlight Border"
        description="Make sure your users notice the survey you display">
        <EditHighlightBorder product={product} />
      </SettingsCard>
      <SettingsCard
        title="Formbricks Signature"
        description="We love your support but understand if you toggle it off.">
        <EditFormbricksSignature product={product} />
      </SettingsCard>
    </div>
  );
}
