import SettingsTitle from "../SettingsTitle";
import SettingsCard from "../SettingsCard";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";

export default function ProfileSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Setup Checklist" />
      <SettingsCard title="Widget Status" description="Check if the Formbricks widget is alive and kicking.">
        <WidgetStatusIndicator environmentId={params.environmentId} type="large" />
      </SettingsCard>
    </div>
  );
}
