import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ClientWorkspaceRedirect from "@/app/ClientWorkspaceRedirect";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getUserWorkspaces } from "@/lib/workspace/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ClientLogout } from "@/modules/ui/components/client-logout";

const Page = async () => {
  const session: Session | null = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();

  if (!session) {
    if (isFreshInstance) {
      return redirect("/setup/intro");
    } else {
      return redirect("/auth/login");
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

  // Collect workspace IDs across all organizations
  const allWorkspaceIds: string[] = [];
  for (const org of userOrganizations) {
    const workspaces = await getUserWorkspaces(user.id, org.id);
    for (const ws of workspaces) {
      allWorkspaceIds.push(ws.id);
    }
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session.user.id,
    userOrganizations[0].id
  );

  const { isManager, isOwner } = getAccessFlags(currentUserMembership?.role);

  if (allWorkspaceIds.length === 0) {
    if (isOwner || isManager) {
      if (IS_FORMBRICKS_CLOUD) {
        return redirect(`/organizations/${userOrganizations[0].id}/workspaces/new/plan`);
      }
      return redirect(`/organizations/${userOrganizations[0].id}/workspaces/new/mode`);
    } else {
      return redirect(`/organizations/${userOrganizations[0].id}/landing`);
    }
  }

  return <ClientWorkspaceRedirect userWorkspaceIds={allWorkspaceIds} />;
};

export default Page;
