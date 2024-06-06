import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { ONBOARDING_DISABLED } from "@formbricks/lib/constants";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { ClientLogout } from "@formbricks/ui/ClientLogout";

const Page = async () => {
  const session: Session | null = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();

  if (!session) {
    if (isFreshInstance) {
      redirect("/setup/freshInstance/intro");
    } else {
      redirect("/auth/login");
    }
  }

  if (!session?.user) {
    return <ClientLogout />;
  }

  const userOrganizations = await getOrganizationsByUserId(session.user.id);
  if (!userOrganizations || userOrganizations.length === 0) {
    return redirect("/setup/organization/create");
  }

  if (!ONBOARDING_DISABLED && !session.user.onboardingCompleted) {
    return redirect(`/onboarding`);
  }

  let environment;
  try {
    environment = await getFirstEnvironmentByUserId(session?.user.id);
    if (!environment) {
      throw new Error("No environment found");
    }
  } catch (error) {
    console.error(`error getting environment: ${error}`);
  }

  if (!environment) {
    console.error("Failed to get first environment of user; signing out");
    return <ClientLogout />;
  }

  return redirect(`/environments/${environment.id}`);
};

export default Page;
