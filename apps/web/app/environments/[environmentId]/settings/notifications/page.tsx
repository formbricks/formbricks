import SettingsCard from "@/app/environments/[environmentId]/settings/SettingsCard";
import SettingsTitle from "../SettingsTitle";
import EditNotifications from "./EditNotifications";

export default function ProfileSettingsPage() {
  return (
    <div>
      <SettingsTitle title="Notifications" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        <EditNotifications />
      </SettingsCard>
    </div>
  );
}
