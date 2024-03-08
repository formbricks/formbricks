import { getServerSession } from "next-auth";

import {
  getRemoveInAppBrandingPermission,
  getRemoveLinkBrandingPermission,
} from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";
import { EditFormbricksBranding } from "./components/EditBranding";
import { EditPlacement } from "./components/EditPlacement";
import UnifiedStyling from "./components/UnifiedStyling";

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

  const canRemoveInAppBranding = getRemoveInAppBrandingPermission(team);
  const canRemoveLinkBranding = getRemoveLinkBrandingPermission(team);

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);
  // const isBrandColorEditDisabled = isDeveloper ? true : isViewer;

  if (isViewer) {
    return <ErrorComponent />;
  }

  return (
    <div>
      <SettingsTitle title="Look & Feel" />
      <SettingsCard
        title="Unified Styling"
        className="max-w-7xl"
        description="Set styling for ALL surveys in this project. You can still overwrite these styles in the survey editor.">
        <UnifiedStyling product={product} />
      </SettingsCard>
      {/* <SettingsCard title="Brand Color" description="Match the surveys with your user interface.">
        <EditBrandColor
          product={product}
          isBrandColorDisabled={isBrandColorEditDisabled}
          environmentId={params.environmentId}
        />
      </SettingsCard> */}
      <SettingsCard
        title="In-app Survey Placement"
        description="Change where surveys will be shown in your web app.">
        <EditPlacement product={product} environmentId={params.environmentId} />
      </SettingsCard>
      {/* <SettingsCard
        noPadding
        title="Highlight Border"
        description="Make sure your users notice the survey you display">
        <EditHighlightBorder
          product={product}
          defaultBrandColor={DEFAULT_BRAND_COLOR}
          environmentId={params.environmentId}
        />
      </SettingsCard> */}
      <SettingsCard
        title="Formbricks Branding"
        description="We love your support but understand if you toggle it off.">
        <EditFormbricksBranding
          type="linkSurvey"
          product={product}
          canRemoveBranding={canRemoveLinkBranding}
          environmentId={params.environmentId}
        />
        <EditFormbricksBranding
          type="inAppSurvey"
          product={product}
          canRemoveBranding={canRemoveInAppBranding}
          environmentId={params.environmentId}
        />
      </SettingsCard>
    </div>
  );
}
