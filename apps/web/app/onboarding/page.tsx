import { getServerSession } from "next-auth";
import Onboarding from "./Onboarding";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  return <Onboarding session={session} />;
}
