import { Onboarding } from "@/app/(app)/onboarding/components/onboarding";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@formbricks/lib/constants";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";

const Page = async () => {
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session) {
    return redirect("/auth/login");
  }

  // Redirect to home if onboarding is completed
  if (session.user.onboardingCompleted) {
    return redirect("/");
  }

  const userId = session.user.id;
  const environment = await getFirstEnvironmentByUserId(userId);
  const user = await getUser(userId);
  const organization = environment ? await getOrganizationByEnvironmentId(environment.id) : null;

  // Ensure all necessary data is available
  if (!environment || !user || !organization) {
    throw new Error("Failed to get necessary user, environment, or organization information");
  }

  return (
    <Onboarding
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      session={session}
      environment={environment}
      user={user}
      organization={organization}
      webAppUrl={WEBAPP_URL}
    />
  );
};

export default Page;
