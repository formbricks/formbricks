import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getUser } from "@formbricks/lib/user/service";
import { InviteTeamMate } from "@formbricks/ui/Onboarding/components/InviteTeamMate";
import OnboardingHeader from "@formbricks/ui/Onboarding/components/OnboardingHeader";

export default async function ConnectPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  const userId = session?.user.id;
  const environment = await getFirstEnvironmentByUserId(userId);

  if (!environment) {
    throw new Error("No environment found for user");
  }

  const user = await getUser(userId);
  const product = await getProductByEnvironmentId(environment.id);
  const team = await getTeamByEnvironmentId(environment.id);
  if (!user || !product || !team) {
    throw new Error("Failed to get team, user, or product");
  }

  return (
    <div className="flex h-full w-full flex-col items-center">
      <OnboardingHeader progress={78} />
      <InviteTeamMate team={team} environmentId={environment.id} />
    </div>
  );
}
