import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { authOptions } from "@formbricks/lib/authOptions";
import { NoMobileOverlay } from "@formbricks/ui/NoMobileOverlay";
import { PHProvider, PostHogPageview } from "@formbricks/ui/PostHogClient";
import { ToasterClient } from "@formbricks/ui/ToasterClient";

const AppLayout = async ({ children }) => {
  const session = await getServerSession(authOptions);

  return (
    <>
      <NoMobileOverlay />
      <Suspense>
        <PostHogPageview />
      </Suspense>
      <PHProvider>
        <>
          {session ? <FormbricksClient session={session} /> : null}
          <ToasterClient />
          {children}
        </>
      </PHProvider>
    </>
  );
};

export default AppLayout;
