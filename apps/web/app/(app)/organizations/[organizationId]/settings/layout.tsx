import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/lib/session";
import { SettingsShell } from "@/modules/settings/components/settings-shell";
import { getSettingsLayoutData } from "@/modules/settings/lib/navigation-data";

const OrgSettingsLayout = async (
  props: Readonly<{
    children: React.ReactNode;
    params: Promise<{ organizationId: string }>;
  }>
) => {
  const { organizationId } = await props.params;
  const session = await getSession();
  if (!session?.user) {
    return redirect("/auth/login");
  }

  const data = await getSettingsLayoutData(session.user.id, organizationId);
  if (!data) {
    return redirect("/");
  }

  return <SettingsShell data={data}>{props.children}</SettingsShell>;
};

export default OrgSettingsLayout;
