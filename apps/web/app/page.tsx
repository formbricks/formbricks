import { WEBAPP_URL } from "@/../../packages/lib/constants";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function getEnvironment() {
  const cookie = headers().get("cookie") || "";
  const res = await fetch(`${WEBAPP_URL}/api/v1/environments/find-first`, {
    headers: {
      cookie,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }

  return res.json();
}

export default async function Home() {
  const session: Session | null = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  if (session?.user && !session?.user?.onboardingCompleted) {
    return redirect(`/onboarding`);
  }

  const environment = await getEnvironment();

  if (!environment) {
    throw Error("No environment found for user");
  }

  return redirect(`/environments/${environment.id}`);
}
