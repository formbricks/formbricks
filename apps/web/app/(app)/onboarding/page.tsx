export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import Onboarding from "./Onboarding";
import { getEnvironmentByUser } from "@formbricks/lib/services/environment";
import { getProfile } from "@formbricks/lib/services/profile";
import { ErrorComponent } from "@formbricks/ui";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  const environment = await getEnvironmentByUser(session?.user);
  const profile = await getProfile(session?.user.id!);
  const product = await getProductByEnvironmentId(environment?.id!);

  if (!environment || !profile || !product) {
    return <ErrorComponent />;
  }

  if (profile.onboardingCompleted) {
    redirect("/");
  }

  return <Onboarding session={session} environmentId={environment?.id} profile={profile} product={product} />;
}
