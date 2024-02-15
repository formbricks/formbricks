import { InviteTeamMate } from "@/app/(app)/onboarding/components/InviteTeamMate";
import { OnboardingHeader } from "@/app/(app)/onboarding/components/OnboardingHeader";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export default async function ConnectPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  if (session.user.onboardingCompleted) {
    redirect("/");
  }
  const userId = session?.user.id;
  const environment = await getFirstEnvironmentByUserId(userId);

  if (!environment) {
    throw new Error("No environment found for user");
  }

  const team = await getTeamByEnvironmentId(environment.id);
  if (!team) {
    throw new Error("Failed to get team, user, or product");
  }

  return (
    <div className="flex h-full w-full flex-col items-center">
      <OnboardingHeader progress={78} />
      <InviteTeamMate team={team} environmentId={environment.id} />
    </div>
  );
}
