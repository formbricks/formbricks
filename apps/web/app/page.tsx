import ClientEnvironmentRedirect from "@/app/ClientEnvironmentRedirect";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getFirstEnvironmentId } from "@formbricks/lib/environment/service";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";

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

  const user = await getUser(session.user.id);
  if (!user) {
    return <ClientLogout />;
  }

  const userOrganizations = await getOrganizationsByUserId(session.user.id);

  if (userOrganizations.length === 0) {
    return redirect("/setup/organization/create");
  }

  let environmentId: string | null = null;
  environmentId = await getFirstEnvironmentId(session.user.id);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session.user.id,
    userOrganizations[0].id
  );
  const { isManager, isOwner } = getAccessFlags(currentUserMembership?.role);

  if (!environmentId) {
    if (isOwner || isManager) {
      return redirect(`/organizations/${userOrganizations[0].id}/projects/new/mode`);
    } else {
      return redirect(`/organizations/${userOrganizations[0].id}/landing`);
    }
  }

  return <ClientEnvironmentRedirect environmentId={environmentId} />;
};

export default Page;
