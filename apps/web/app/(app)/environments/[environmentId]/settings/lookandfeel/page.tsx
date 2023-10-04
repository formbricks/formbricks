export const revalidate = REVALIDATION_INTERVAL;

import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditFormbricksSignature } from "./EditSignature";
import { EditBrandColor } from "./EditBrandColor";
import { EditPlacement } from "./EditPlacement";
import { EditHighlightBorder } from "./EditHighlightBorder";
import { DEFAULT_BRAND_COLOR } from "@formbricks/lib/constants";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const product = await getProductByEnvironmentId(params.environmentId);
  if (!product) {
    throw new Error("Product not found");
  }

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
        <EditHighlightBorder product={product} defaultBrandColor={DEFAULT_BRAND_COLOR} />
      </SettingsCard>
      <SettingsCard
        title="Formbricks Signature"
        description="We love your support but understand if you toggle it off.">
        <EditFormbricksSignature product={product} />
      </SettingsCard>
    </div>
  );
}
