import { getServerSession } from "next-auth";
import Onboarding from "./Onboarding";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import FormbricksClient from "@/app/FormbricksClient";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  return (
    <>
      <FormbricksClient session={session} />
      <Onboarding session={session} />
    </>
  );
}
