import SettingsTitle from "../SettingsTitle";
import SettingsCard from "../SettingsCard";
import WidgetStatusIndicator from "./WidgetStatusIndicator";

export default function ProfileSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Setup Checklist" />
      <SettingsCard
        title="Widget Status Indicator"
        description="Check if the Formbricks widget is alive and kicking.">
        <WidgetStatusIndicator environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
