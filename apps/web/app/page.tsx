import { redirect } from "next/navigation";
import { getIsFreshInstance } from "@/lib/instance/service";
import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";
import { getActiveOrganizationId } from "@/modules/shell/lib/active-organization";
import { ClientLogout } from "@/modules/ui/components/client-logout";

const Page = async () => {
  const session = await getSession();

  if (!session) {
    return redirect((await getIsFreshInstance()) ? "/setup/intro" : "/auth/login");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return <ClientLogout />;
  }

  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    return redirect("/account/no-organization");
  }

  return redirect(`/organizations/${organizationId}`);
};

export default Page;
