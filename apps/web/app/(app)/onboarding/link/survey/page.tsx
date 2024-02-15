import { OnboardingLinkSurvey } from "@/app/(app)/onboarding/components/OnboardingLinkSurvey";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

export default async function LinkSurveyOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  if (session.user.onboardingCompleted) {
    redirect("/");
  }

  return <OnboardingLinkSurvey />;
}
