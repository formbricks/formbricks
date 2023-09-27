export const revalidate = REVALIDATION_INTERVAL;

import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditFormbricksSignature } from "./EditSignature";
import { EditBrandColor } from "./EditBrandColor";
import { EditPlacement } from "./EditPlacement";
import { EditHighlightBorder } from "./EditHighlightBorder";
import { getTeamByEnvironmentId } from "@formbricks/lib/services/team";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const team = await getTeamByEnvironmentId(params.environmentId);
  if (!team) {
    throw new Error("Team not found");
  }
  const canRemoveSignature = team.subscription.addOns.includes("removeBranding");
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
        <EditHighlightBorder product={product} />
      </SettingsCard>
      <SettingsCard
        title="Formbricks Signature"
        description={
          canRemoveSignature ? (
            "We love your support but understand if you toggle it off."
          ) : (
            <>
              To remove the Formbricks branding from the web-app surveys, please buy the add-on for 10$/month{" "}
              <a href={`/environments/${params.environmentId}/settings/billing`}>here</a>.
            </>
          )
        }>
        <EditFormbricksSignature product={product} canRemoveSignature={canRemoveSignature} />
      </SettingsCard>
    </div>
  );
}
