import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/lib/session";
import { SettingsShell } from "@/modules/settings/components/settings-shell";
import { getSettingsLayoutData } from "@/modules/settings/lib/navigation-data";

const AccountSettingsLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const session = await getSession();
  if (!session?.user) {
    return redirect("/auth/login");
  }

  const data = await getSettingsLayoutData(session.user.id);
  if (!data) {
    return redirect("/");
  }

  return <SettingsShell data={data}>{children}</SettingsShell>;
};

export default AccountSettingsLayout;
