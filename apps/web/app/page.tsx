import ClientEnvironmentRedirect from "@/app/ClientEnvironmentRedirect";
import { getIsFreshInstance } from "@/lib/instance/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getProjectEnvironmentsByOrganizationIds } from "@/lib/project/service";
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

  const projectsByOrg = await getProjectEnvironmentsByOrganizationIds(userOrganizations.map((org) => org.id));

  // Flatten all environments from all projects across all organizations
  const allEnvironments = projectsByOrg.flatMap((project) => project.environments);

  // Find first production environment and collect all other environment IDs in one pass
  const { firstProductionEnvironmentId, otherEnvironmentIds } = allEnvironments.reduce(
    (acc, env) => {
      if (env.type === "production" && !acc.firstProductionEnvironmentId) {
        acc.firstProductionEnvironmentId = env.id;
      } else {
        acc.otherEnvironmentIds.add(env.id);
      }
      return acc;
    },
    { firstProductionEnvironmentId: null as string | null, otherEnvironmentIds: new Set<string>() }
  );

  const userEnvironments = [...otherEnvironmentIds];

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
  const sortedUserEnvironments = [firstProductionEnvironmentId, ...userEnvironments];

  return <ClientEnvironmentRedirect userEnvironments={sortedUserEnvironments} />;
};

export default Page;
