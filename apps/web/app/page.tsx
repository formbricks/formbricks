import ClientLogout from "@/app/ClientLogout";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
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
    const error = await res.json();
    console.error(error);
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

  let environment;
  try {
    environment = await getEnvironment();
  } catch (error) {
    console.error("error getting environment", error);
  }

  if (!environment) {
    console.error("Failed to get first environment of user; signing out");
    return <ClientLogout />;
  }

  return redirect(`/environments/${environment.id}`);
}
