export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { DeleteAccount } from "./DeleteAccount";
import { EditName } from "./EditName";
import { EditAvatar } from "./EditAvatar";
import { getProfile } from "@formbricks/lib/profile/service";

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  const profile = session ? await getProfile(session.user.id) : null;

  return (
    <>
      {profile && (
        <div>
          <SettingsTitle title="Profile" />
          <SettingsCard title="Personal Information" description="Update your personal information.">
            <EditName profile={profile} />
          </SettingsCard>
          <SettingsCard title="Avatar" description="Assist your team in identifying you on Formbricks.">
            <EditAvatar session={session} />
          </SettingsCard>
          <SettingsCard
            title="Delete account"
            description="Delete your account with all of your personal information and data.">
            <DeleteAccount session={session} />
          </SettingsCard>
        </div>
      )}
    </>
  );
}
