import { Onboarding } from "@/app/(app)/onboarding/components/onboarding";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  if (session.user.onboardingCompleted) {
    redirect("/");
  }

  return <Onboarding isFormbricksCloud={true} />;
}
