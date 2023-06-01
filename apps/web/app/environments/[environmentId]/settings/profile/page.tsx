import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { getServerSession } from "next-auth";
import { EditName, EditAvatar } from "./editProfile";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  return (
    <div>
      <SettingsTitle title="Profile" />
      <SettingsCard title="Personal Information" description="Update your personal information.">
        <EditName />
      </SettingsCard>
      <SettingsCard title="Avatar" description="Assist your team in identifying you on Formbricks.">
        <EditAvatar session={session} />
      </SettingsCard>
    </div>
  );
}
