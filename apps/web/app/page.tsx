import ClientEnvironmentRedirect from "@/app/ClientEnvironmentRedirect";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getFirstEnvironmentIdByUserId } from "@formbricks/lib/environment/service";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { TEnvironment } from "@formbricks/types/environment";
import { ClientLogout } from "@formbricks/ui/components/ClientLogout";

const Page = async () => {
  const session: Session | null = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();

  if (!session) {
    if (isFreshInstance) {
      redirect("/setup/intro");
    } else {
      redirect("/auth/login");
    }
  }

  if (!session?.user) {
    return <ClientLogout />;
  }

  const userOrganizations = await getOrganizationsByUserId(session.user.id);

  if (userOrganizations.length === 0) {
    return redirect("/setup/organization/create");
  }

  let environmentId: string | null = null;
  try {
    environmentId = await getFirstEnvironmentIdByUserId(session?.user.id);
  } catch (error) {
    console.error(`error getting environment: ${error}`);
  }

  if (!environmentId) {
    console.error("Failed to get first environment of user");
    return redirect(`/organizations/${userOrganizations[0].id}/products/new/mode`);
  }

  return <ClientEnvironmentRedirect environmentId={environmentId} />;
};

export default Page;
