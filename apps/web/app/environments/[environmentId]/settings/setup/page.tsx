import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import EnvironmentNotice from "./EnvironmentNotice";
import SetupInstructions from "./SetupInstructions";

export default function ProfileSettingsPage({ params }) {
  return (
    <div className="space-y-4">
      <SettingsTitle title="Setup Checklist" />
      <SettingsCard title="Widget Status" description="Check if the Formbricks widget is alive and kicking.">
        <WidgetStatusIndicator environmentId={params.environmentId} type="large" />
      </SettingsCard>

      <EnvironmentNotice environmentId={params.environmentId} />
      <SettingsCard
        title="How to setup"
        description="Follow these steps to setup the Formbricks widget within your app"
        noPadding>
        <SetupInstructions environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
