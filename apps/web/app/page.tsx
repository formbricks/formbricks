import ClientEnvironmentRedirect from "@/app/ClientEnvironmentRedirect";
import { getFirstEnvironmentIdByUserId } from "@/lib/environment/service";
import { getIsFreshInstance } from "@/lib/instance/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUserProjects } from "@/lib/project/service";
import { getUser } from "@/lib/user/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

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

  let firstEnvironmentId: string | null = null;
  firstEnvironmentId = await getFirstEnvironmentIdByUserId(session.user.id);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session.user.id,
    userOrganizations[0].id
  );
  const { isManager, isOwner } = getAccessFlags(currentUserMembership?.role);

  if (!firstEnvironmentId) {
    if (isOwner || isManager) {
      return redirect(`/organizations/${userOrganizations[0].id}/projects/new/mode`);
    } else {
      return redirect(`/organizations/${userOrganizations[0].id}/landing`);
    }
  }

  let userEnvironments: string[] = [];

  for (const org of userOrganizations) {
    const projects = await getUserProjects(session.user.id, org.id);
    const environmentIds = projects.flatMap((project) => project.environments.map((env) => env.id));
    userEnvironments.push(...environmentIds);
  }

  return <ClientEnvironmentRedirect environmentId={firstEnvironmentId} userEnvironments={userEnvironments} />;
};

export default Page;
