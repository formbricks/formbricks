export const revalidate = REVALIDATION_INTERVAL;

import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";
import { EditFormbricksSignature } from "./components/EditSignature";
import { EditBrandColor } from "./components/EditBrandColor";
import { EditPlacement } from "./components/EditPlacement";
import { EditHighlightBorder } from "./components/EditHighlightBorder";
import { DEFAULT_BRAND_COLOR } from "@formbricks/lib/constants";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const [session, team, product] = await Promise.all([
    getServerSession(authOptions),
    getTeamByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const canRemoveSignature = team.billing.features.linkSurvey.status !== "inactive";
  const { isDeveloper, isViewer } = getAccessFlags(currentUserMembership?.role);
  const isBrandColorEditDisabled = isDeveloper ? true : isViewer;

  if (isViewer) {
    return <ErrorComponent />;
  }

  return (
    <div>
      <SettingsTitle title="Look & Feel" />
      <SettingsCard title="Brand Color" description="Match the surveys with your user interface.">
        <EditBrandColor product={product} isBrandColorDisabled={isBrandColorEditDisabled} />
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
        <EditFormbricksSignature
          product={product}
          canRemoveSignature={canRemoveSignature}
          environmentId={params.environmentId}
        />
      </SettingsCard>
    </div>
  );
}
