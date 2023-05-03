import { getServerSession } from "next-auth";
import Onboarding from "./Onboarding";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  return <Onboarding session={session} />;
}
