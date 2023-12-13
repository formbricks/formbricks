import AccountSecurity from "@/app/(app)/environments/[environmentId]/settings/profile/components/AccountSecurity";
import { authOptions } from "@formbricks/lib/authOptions";
import { getUser } from "@formbricks/lib/user/service";
import { SettingsId } from "@formbricks/ui/SettingsId";
import { getServerSession } from "next-auth";
import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";
import { DeleteAccount } from "./components/DeleteAccount";
import { EditAvatar } from "./components/EditAvatar";
import { EditName } from "./components/EditName";

export default async function ProfileSettingsPage({ params }: { params: { environmentId: string } }) {
  const { environmentId } = params;
  const session = await getServerSession(authOptions);
  const user = session && session.user ? await getUser(session.user.id) : null;

  return (
    <>
      {user && (
        <div>
          <SettingsTitle title="Profile" />
          <SettingsCard title="Personal Information" description="Update your personal information.">
            <EditName user={user} />
          </SettingsCard>
          <SettingsCard title="Avatar" description="Assist your team in identifying you on Formbricks.">
            <EditAvatar session={session} environmentId={environmentId} />
          </SettingsCard>
          {user.identityProvider === "email" && (
            <SettingsCard title="Security" description="Manage your password and other security settings.">
              <AccountSecurity user={user} />
            </SettingsCard>
          )}

          <SettingsCard
            title="Delete account"
            description="Delete your account with all of your personal information and data.">
            <DeleteAccount session={session} />
          </SettingsCard>
          <SettingsId title="Profile" id={user.id}></SettingsId>
        </div>
      )}
    </>
  );
}
