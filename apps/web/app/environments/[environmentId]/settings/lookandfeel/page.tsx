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
        title="In-app Survey Placement"
        description="Change where surveys will be shown in your web app.">
        <EditPlacement environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        title="Formbricks Signature"
        description="We love your support but understand if you toggle it off.">
        <EditFormbricksSignature environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
