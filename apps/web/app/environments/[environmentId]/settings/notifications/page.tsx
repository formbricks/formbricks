import SettingsCard from "@/app/environments/[environmentId]/settings/SettingsCard";
import SettingsTitle from "../SettingsTitle";
import EditAlerts from "./EditAlerts";

export default function ProfileSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Notifications" />
      <SettingsCard title="Email alerts" description="Set up an alert to get notified on new responses.">
        <EditAlerts environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
