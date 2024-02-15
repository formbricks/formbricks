import { Connect } from "@/app/(app)/onboarding/components/Connect";
import { OnboardingHeader } from "@/app/(app)/onboarding/components/OnboardingHeader";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";

export default async function ConnectPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  if (session.user?.onboardingCompleted) {
    redirect("/");
  }
  const userId = session?.user.id;
  const environment = await getFirstEnvironmentByUserId(userId);

  if (!environment) {
    throw new Error("No environment found for user");
  }

  return (
    <div className="flex flex-col items-center">
      <OnboardingHeader progress={70} />
      <Connect environment={environment} webAppUrl={WEBAPP_URL} />
    </div>
  );
}
