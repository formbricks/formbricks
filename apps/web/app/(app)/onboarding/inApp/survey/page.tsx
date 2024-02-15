import { OnboardingHeader } from "@/app/(app)/onboarding/components/OnboardingHeader";
import { OnboardingInAppSurvey } from "@/app/(app)/onboarding/components/OnboardingInAppSurvey";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";

export default async function InAppSurveyOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  const userId = session?.user.id;
  const environment = await getFirstEnvironmentByUserId(userId);

  if (session.user.onboardingCompleted) {
    redirect("/");
  }
  const user = await getUser(userId);
  const product = await getProductByEnvironmentId(environment?.id!);

  if (!environment || !user || !product) {
    throw new Error("Failed to get environment, user, or product");
  }
  return (
    <div className="flex h-full w-full flex-col items-center">
      <OnboardingHeader progress={51} />
      <OnboardingInAppSurvey session={session} environmentId={environment.id} user={user} product={product} />
    </div>
  );
}
