import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditBrandColor, EditPlacement, EditFormbricksSignature } from "./editLookAndFeel";

export default function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  return (
    <div>
      <SettingsTitle title="Look & Feel" />
      <SettingsCard title="Brand Color" description="Match the surveys with your user interface.">
        <EditBrandColor environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        soon
        title="Survey Placement"
        description="Change where surveys will be shown in your product.">
        <EditPlacement environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        soon
        title="Formbricks Signature"
        description="As of now, there is no Formbricks branding on your surveys.">
        <EditFormbricksSignature environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
