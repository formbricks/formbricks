export const revalidate = REVALIDATION_INTERVAL;

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getFirstEnvironmentByUserId } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getProfile } from "@formbricks/lib/services/profile";
import { getServerSession } from "next-auth";
import Onboarding from "./components/Onboarding";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("No session found");
  }
  const environment = await getFirstEnvironmentByUserId(session?.user.id);
  const profile = await getProfile(session?.user.id!);
  const product = await getProductByEnvironmentId(environment?.id!);

  if (!environment || !profile || !product) {
    throw new Error("Failed to get environment, profile, or product");
  }

  return <Onboarding session={session} environmentId={environment.id} profile={profile} product={product} />;
}
