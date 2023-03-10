import SettingsCard from "@/components/settings/SettingsCard";
import SettingsTitle from "@/components/settings/SettingsTitle";
import { EditName, EditAvatar } from "./editProfile";

export default function ProfileSettingsPage() {
  return (
    <div>
      <SettingsTitle title="Notifications" />
      {/*       <SettingsCard title="Personal Information" description="Update your personal information.">
        <EditName />
      </SettingsCard>
      <SettingsCard title="Avatar" description="Assist your team in identifying you on Formbricks.">
        <EditAvatar />
      </SettingsCard> */}
    </div>
  );
}
