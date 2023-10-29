export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";
import { DeleteAccount } from "./components/DeleteAccount";
import { EditName } from "./components/EditName";
import { EditAvatar } from "./components/EditAvatar";
import AccountSecurity from "@/app/(app)/environments/[environmentId]/settings/profile/components/AccountSecurity";
import { getProfile } from "@formbricks/lib/profile/service";

export default async function ProfileSettingsPage({ params }) {
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
          {profile.identityProvider === "email" && (
            <SettingsCard title="Security" description="Manage your password and other security settings.">
              <AccountSecurity profile={profile} />
            </SettingsCard>
          )}

          <SettingsCard
            title="Delete account"
            description="Delete your account with all of your personal information and data.">
            <DeleteAccount session={session} environmentId={params.environmentId} />
          </SettingsCard>
        </div>
      )}
    </>
  );
}
