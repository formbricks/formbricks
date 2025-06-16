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

  const userEnvironmentsSet = new Set<string>();
  let firstProductionEnvironmentId: string | null = null;

  const projectsByOrg = await Promise.all(
    userOrganizations.map((org) => getUserProjects(session.user.id, org.id))
  );

  for (const projects of projectsByOrg) {
    for (const project of projects) {
      for (const env of project.environments) {
        userEnvironmentsSet.add(env.id);
        if (!firstProductionEnvironmentId && env.type === "production") {
          firstProductionEnvironmentId = env.id;
        }
      }
    }
  }

  const userEnvironments = [...userEnvironmentsSet];

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
