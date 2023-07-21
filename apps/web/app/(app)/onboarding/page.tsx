import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import Onboarding from "./Onboarding";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  return <Onboarding session={session} />;
}
