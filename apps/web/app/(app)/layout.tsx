import FormbricksClient from "@/app/(app)/FormbricksClient";
import { PHProvider, PostHogPageview } from "@/app/PostHogClient";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PosthogIdentify from "./PosthogIdentify";
import { NoMobileOverlay } from "@formbricks/ui";

export default async function AppLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return redirect(`/auth/login`);
  }

  return (
    <>
      <NoMobileOverlay />
      <Suspense>
        <PostHogPageview />
      </Suspense>
      <PHProvider>
        <>
          <PosthogIdentify session={session} />
          <FormbricksClient session={session} />
          {children}
        </>
      </PHProvider>
    </>
  );
}
