export const revalidate = REVALIDATION_INTERVAL;

import { authOptions } from "@formbricks/lib/authOptions";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getProfile } from "@formbricks/lib/profile/service";
import { getServerSession } from "next-auth";
import Onboarding from "./components/Onboarding";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  const userId = session?.user.id;
  const environment = await getFirstEnvironmentByUserId(userId);

  if (!environment) {
    throw new Error("No environment found for user");
  }

  const profile = await getProfile(userId);
  const product = await getProductByEnvironmentId(environment?.id!);

  if (!environment || !profile || !product) {
    throw new Error("Failed to get environment, profile, or product");
  }

  return <Onboarding session={session} environmentId={environment.id} profile={profile} product={product} />;
}
