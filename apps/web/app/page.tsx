import ClientEnvironmentRedirect from "@/app/ClientEnvironmentRedirect";
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

  let userEnvironments: string[] = [];
  let firstProductionEnvironmentId: string | null = null;

  // Get all projects and environments, and find the first production environment
  for (const org of userOrganizations) {
    const projects = await getUserProjects(session.user.id, org.id);

    for (const project of projects) {
      const environmentIds = project.environments.map((env) => env.id);
      userEnvironments.push(...environmentIds);

      // Find the first production environment
      if (!firstProductionEnvironmentId) {
        const productionEnvironment = project.environments.find(
          (environment) => environment.type === "production"
        );

        if (productionEnvironment) {
          firstProductionEnvironmentId = productionEnvironment.id;
        }
      }
    }
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session.user.id,
    userOrganizations[0].id
  );
  const { isManager, isOwner } = getAccessFlags(currentUserMembership?.role);

  if (!firstProductionEnvironmentId) {
    if (isOwner || isManager) {
      return redirect(`/organizations/${userOrganizations[0].id}/projects/new/mode`);
    } else {
      return redirect(`/organizations/${userOrganizations[0].id}/landing`);
    }
  }

  // Put the first production environment at the front of the array
  const sortedUserEnvironments = [
    firstProductionEnvironmentId,
    ...userEnvironments.filter((id) => id !== firstProductionEnvironmentId),
  ];

  return <ClientEnvironmentRedirect userEnvironments={sortedUserEnvironments} />;
};

export default Page;
