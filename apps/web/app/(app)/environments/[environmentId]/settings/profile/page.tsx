import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { getServerSession } from "next-auth";
import { EditName, EditAvatar, DeleteAccount } from "./editProfile";
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
      <SettingsCard
        title="Delete account"
        description="Delete your account, your personal information, your preferences and access to your data"
        dangerZone>
        <DeleteAccount session={session} />
      </SettingsCard>
    </div>
  );
}
